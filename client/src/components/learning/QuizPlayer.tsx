import { useState } from 'react';
import { CheckCircle2, RotateCcw, Trophy, XCircle } from 'lucide-react';
import { getErrorMessage, type Lesson, type QuizAttemptResult } from '@/api';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Làm bài kiểm tra: chọn đáp án, gửi lên máy chủ chấm điểm, xem kết quả & giải thích */
export function QuizPlayer({
  lesson,
  canSubmit,
  submitting,
  onSubmit,
}: {
  lesson: Lesson;
  /** Chỉ học viên mới nộp bài; giảng viên/admin đang xem trước */
  canSubmit: boolean;
  submitting: boolean;
  onSubmit: (answers: number[]) => Promise<QuizAttemptResult>;
}) {
  const [answers, setAnswers] = useState<(number | null)[]>(() => lesson.questions.map(() => null));
  const [result, setResult] = useState<QuizAttemptResult | null>(null);
  const [error, setError] = useState('');

  const unanswered = answers.findIndex(a => a === null);

  const submit = async () => {
    setError('');
    if (unanswered >= 0) {
      setError(`Bạn chưa trả lời câu ${unanswered + 1}.`);
      return;
    }
    try {
      setResult(await onSubmit(answers as number[]));
    } catch (err) {
      setError(getErrorMessage(err, 'Chưa nộp được bài. Hãy thử lại.'));
    }
  };

  const retry = () => {
    setResult(null);
    setAnswers(lesson.questions.map(() => null));
  };

  if (lesson.questions.length === 0) {
    return <p className="text-sm text-muted-foreground">Bài kiểm tra chưa có câu hỏi.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{lesson.questions.length} câu hỏi</span>
        <span>·</span>
        <span>Cần đạt {lesson.passScore}% để hoàn thành</span>
        {lesson.bestScore !== null && (
          <>
            <span>·</span>
            <span>Điểm cao nhất của bạn: {lesson.bestScore}%</span>
          </>
        )}
      </div>

      {result && (
        <div
          className={cn(
            'flex items-center gap-3 rounded-xl border p-4',
            result.passed ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-amber-500/30 bg-amber-500/10',
          )}
          role="status"
        >
          {result.passed ? <Trophy className="h-6 w-6 shrink-0 text-emerald-600" /> : <RotateCcw className="h-6 w-6 shrink-0 text-amber-600" />}
          <div className="flex-1 text-sm">
            <p className="font-bold">
              {result.score}% · {result.correctCount}/{result.total} câu đúng
            </p>
            <p className="text-xs text-muted-foreground">
              {result.passed
                ? result.completion?.pointsAwarded
                  ? `Đạt yêu cầu! +${result.completion.pointsAwarded} điểm thưởng${result.completion.certificateIssued ? ' · Bạn vừa được cấp chứng chỉ.' : '.'}`
                  : 'Đạt yêu cầu.'
                : `Chưa đạt (cần ${result.passScore}%). Xem lại giải thích và làm lại nhé.`}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={retry}>
            <RotateCcw size={13} className="mr-1.5" /> Làm lại
          </Button>
        </div>
      )}

      {lesson.questions.map((q, qi) => {
        const outcome = result?.results[qi];
        return (
          <fieldset key={q.id} className="rounded-xl border border-border bg-card p-4">
            <legend className="sr-only">Câu {qi + 1}</legend>
            <p className="mb-3 text-sm font-semibold">
              <span className="mr-1.5 text-muted-foreground">{qi + 1}.</span>
              {q.prompt}
            </p>
            <div className="space-y-2">
              {q.options.map((option, oi) => {
                const chosen = answers[qi] === oi;
                const isCorrect = outcome && outcome.correctIndex === oi;
                const isWrongChoice = outcome && chosen && !outcome.correct;
                return (
                  <label
                    key={oi}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition',
                      !outcome && (chosen ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'),
                      isCorrect && 'border-emerald-500/50 bg-emerald-500/10',
                      isWrongChoice && 'border-destructive/50 bg-destructive/10',
                      outcome && !isCorrect && !isWrongChoice && 'border-border opacity-70',
                      result && 'cursor-default',
                    )}
                  >
                    <input
                      type="radio"
                      name={`q-${q.id}`}
                      checked={chosen}
                      disabled={Boolean(result)}
                      onChange={() => {
                        setAnswers(a => a.map((v, i) => (i === qi ? oi : v)));
                        setError('');
                      }}
                      className="accent-primary"
                    />
                    <span className="flex-1">{option}</span>
                    {isCorrect && <CheckCircle2 size={16} className="text-emerald-600" />}
                    {isWrongChoice && <XCircle size={16} className="text-destructive" />}
                  </label>
                );
              })}
            </div>
            {outcome?.explanation && (
              <p className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                <b className="text-foreground">Giải thích:</b> {outcome.explanation}
              </p>
            )}
          </fieldset>
        );
      })}

      {!result && (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => void submit()} disabled={!canSubmit || submitting}>
            {submitting ? 'Đang chấm…' : 'Nộp bài'}
          </Button>
          {!canSubmit && <span className="text-xs text-muted-foreground">Chế độ xem trước: chỉ học viên mới nộp bài.</span>}
          {error && <span className="text-xs text-destructive">{error}</span>}
        </div>
      )}
    </div>
  );
}
