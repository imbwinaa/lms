import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getErrorMessage,
  getGetLessonQueryKey,
  invalidateLms,
  replaceQuizQuestions,
  updateLesson,
  useGetLesson,
  type Lesson,
  type LessonUpdate,
} from '@/api';
import { newQuestionKey, quizProblem, toQuestionInput, type DraftQuestion } from './QuizBuilder';

export type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export type LessonDraft = {
  title: string;
  contentHtml: string;
  mediaUrl: string | null;
  durationMinutes: number;
  passScore: number;
  questions: DraftQuestion[];
};

const AUTOSAVE_MS = 800;

function toDraft(lesson: Lesson): LessonDraft {
  return {
    title: lesson.title,
    contentHtml: lesson.contentHtml,
    mediaUrl: lesson.mediaUrl,
    durationMinutes: lesson.durationMinutes,
    passScore: lesson.passScore,
    questions: lesson.questions.map(q => ({
      key: newQuestionKey(),
      prompt: q.prompt,
      options: [...q.options],
      correctIndex: q.correctIndex ?? 0,
      explanation: q.explanation ?? '',
    })),
  };
}

const questionsJson = (questions: DraftQuestion[]) => JSON.stringify(questions.map(toQuestionInput));

/**
 * Bản nháp của bài học đang mở trong studio: tự lưu sau 0,8 giây ngừng gõ,
 * lưu ngay khi chuyển bài, và cung cấp flush() trước các thao tác như xuất bản.
 */
export function useLessonDraft(lessonId: number | null, onError: (message: string) => void) {
  const queryClient = useQueryClient();
  const lessonQuery = useGetLesson(lessonId ?? 0, { query: { enabled: lessonId !== null } });
  const lesson = lessonId !== null ? lessonQuery.data : undefined;

  const [draft, setDraft] = useState<LessonDraft | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [quizHint, setQuizHint] = useState<string | null>(null);

  const loadedId = useRef<number | null>(null);
  const saved = useRef<LessonDraft | null>(null);
  const latest = useRef<LessonDraft | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saving = useRef<Promise<void> | null>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  latest.current = draft;

  const save = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const id = loadedId.current;
    const current = latest.current;
    const base = saved.current;
    if (id === null || !current || !base) return;

    const patch: LessonUpdate = {};
    if (current.title.trim() && current.title !== base.title) patch.title = current.title.trim();
    if (current.contentHtml !== base.contentHtml) patch.contentHtml = current.contentHtml;
    if (current.mediaUrl !== base.mediaUrl) patch.mediaUrl = current.mediaUrl;
    if (current.durationMinutes !== base.durationMinutes) patch.durationMinutes = current.durationMinutes;
    if (current.passScore !== base.passScore) patch.passScore = current.passScore;

    const questionsChanged = questionsJson(current.questions) !== questionsJson(base.questions);
    const problem = questionsChanged ? quizProblem(current.questions) : null;
    setQuizHint(problem);
    const saveQuestions = questionsChanged && !problem;

    if (!Object.keys(patch).length && !saveQuestions) {
      setSaveState(s => (s === 'pending' ? (problem ? 'idle' : 'saved') : s));
      return;
    }

    setSaveState('saving');
    const run = (async () => {
      try {
        let updated: Lesson | null = null;
        if (Object.keys(patch).length) updated = await updateLesson(id, patch);
        if (saveQuestions) updated = await replaceQuizQuestions(id, { questions: current.questions.map(toQuestionInput) });
        saved.current = {
          ...current,
          title: patch.title ?? base.title,
          questions: saveQuestions ? current.questions : base.questions,
        };
        if (updated) queryClient.setQueryData(getGetLessonQueryKey(id), updated);
        if (patch.title !== undefined || patch.durationMinutes !== undefined) void invalidateLms(queryClient);
        setSaveState('saved');
      } catch (err) {
        setSaveState('error');
        onErrorRef.current(getErrorMessage(err, 'Chưa lưu được thay đổi. Hãy thử lại.'));
      }
    })();
    saving.current = run;
    await run;
    saving.current = null;
  }, [queryClient]);

  /** Lưu ngay mọi thay đổi đang chờ (dùng trước khi xuất bản / rời trang) */
  const flush = useCallback(async () => {
    if (saving.current) await saving.current;
    await save();
  }, [save]);

  // Nạp bản nháp khi mở bài học mới; lưu bài cũ trước khi chuyển
  useEffect(() => {
    if (!lesson || loadedId.current === lesson.id) return;
    void save();
    loadedId.current = lesson.id;
    const fresh = toDraft(lesson);
    saved.current = fresh;
    setDraft(fresh);
    setSaveState('idle');
    setQuizHint(null);
  }, [lesson, save]);

  // Bỏ chọn bài (VD: vừa xóa bài/chương) -> hủy lưu đang chờ, không gửi lên bài đã xóa
  useEffect(() => {
    if (lessonId !== null) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    loadedId.current = null;
    saved.current = null;
    setDraft(null);
    setSaveState('idle');
  }, [lessonId]);

  // Lưu khi rời trang studio
  useEffect(() => () => void save(), [save]);

  const update = useCallback((patch: Partial<LessonDraft>) => {
    setDraft(d => (d ? { ...d, ...patch } : d));
    setSaveState('pending');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), AUTOSAVE_MS);
  }, [save]);

  const ready = Boolean(draft && lesson && loadedId.current === lesson.id);

  return {
    lesson,
    lessonQuery,
    draft: ready ? draft : null,
    update,
    flush,
    saveState,
    quizHint,
  };
}
