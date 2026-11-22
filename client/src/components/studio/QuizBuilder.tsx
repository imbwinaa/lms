import { CheckCircle2, Circle, Plus, Trash2 } from 'lucide-react';
import type { QuizQuestionInput } from '@/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export type DraftQuestion = { key: string; prompt: string; options: string[]; correctIndex: number; explanation: string };

let keySeed = 0;
export const newQuestionKey = () => `q-${Date.now()}-${keySeed++}`;

export const emptyQuestion = (): DraftQuestion => ({
  key: newQuestionKey(),
  prompt: '',
  options: ['', ''],
  correctIndex: 0,
  explanation: '',
});

/** Câu hỏi hợp lệ để lưu? Trả về lỗi đầu tiên (hoặc null) */
export function quizProblem(questions: DraftQuestion[]): string | null {
  for (const [i, q] of questions.entries()) {
    if (!q.prompt.trim()) return `Câu ${i + 1}: chưa có nội dung câu hỏi.`;
    if (q.options.some(o => !o.trim())) return `Câu ${i + 1}: có lựa chọn đang để trống.`;
  }
  return null;
}

export const toQuestionInput = (q: DraftQuestion): QuizQuestionInput => ({
  prompt: q.prompt.trim(),
  options: q.options.map(o => o.trim()),
  correctIndex: q.correctIndex,
  explanation: q.explanation.trim() || undefined,
});

export function QuizBuilder({
  questions,
  onChange,
}: {
  questions: DraftQuestion[];
  onChange: (questions: DraftQuestion[]) => void;
}) {
  const update = (key: string, patch: Partial<DraftQuestion>) =>
    onChange(questions.map(q => (q.key === key ? { ...q, ...patch } : q)));

  return (
    <div className="space-y-4">
      {questions.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <p className="text-sm font-semibold">Chưa có câu hỏi nào</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Thêm câu hỏi trắc nghiệm. Học viên đạt điểm tối thiểu sẽ hoàn thành bài này.
          </p>
        </div>
      )}

      {questions.map((q, index) => (
        <div key={q.key} className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">Câu {index + 1}</span>
            <button
              type="button"
              onClick={() => onChange(questions.filter(x => x.key !== q.key))}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
              aria-label={`Xóa câu ${index + 1}`}
            >
              <Trash2 size={14} />
            </button>
          </div>
          <Textarea
            value={q.prompt}
            onChange={e => update(q.key, { prompt: e.target.value })}
            placeholder="Nội dung câu hỏi"
            rows={2}
            className="text-sm"
          />

          <p className="mb-1.5 mt-3 text-[11px] font-semibold text-muted-foreground">
            Các lựa chọn · bấm vòng tròn để chọn đáp án đúng
          </p>
          <div className="space-y-2">
            {q.options.map((option, optionIndex) => {
              const correct = q.correctIndex === optionIndex;
              return (
                <div key={optionIndex} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => update(q.key, { correctIndex: optionIndex })}
                    aria-label={`Đặt lựa chọn ${optionIndex + 1} là đáp án đúng`}
                    aria-pressed={correct}
                    className={cn('shrink-0', correct ? 'text-emerald-600' : 'text-muted-foreground hover:text-foreground')}
                  >
                    {correct ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                  </button>
                  <Input
                    value={option}
                    onChange={e =>
                      update(q.key, { options: q.options.map((o, i) => (i === optionIndex ? e.target.value : o)) })
                    }
                    placeholder={`Lựa chọn ${optionIndex + 1}`}
                    className={cn('h-9 text-sm', correct && 'border-emerald-500/50')}
                  />
                  <button
                    type="button"
                    disabled={q.options.length <= 2}
                    onClick={() =>
                      update(q.key, {
                        options: q.options.filter((_, i) => i !== optionIndex),
                        correctIndex:
                          q.correctIndex === optionIndex ? 0 : q.correctIndex > optionIndex ? q.correctIndex - 1 : q.correctIndex,
                      })
                    }
                    className="rounded-md p-1 text-muted-foreground hover:text-destructive disabled:opacity-30"
                    aria-label={`Xóa lựa chọn ${optionIndex + 1}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>
          {q.options.length < 6 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-1 h-7 text-xs"
              onClick={() => update(q.key, { options: [...q.options, ''] })}
            >
              <Plus size={13} className="mr-1" /> Thêm lựa chọn
            </Button>
          )}

          <Input
            value={q.explanation}
            onChange={e => update(q.key, { explanation: e.target.value })}
            placeholder="Giải thích đáp án (hiện cho học viên sau khi nộp bài, không bắt buộc)"
            className="mt-3 h-9 text-xs"
          />
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...questions, emptyQuestion()])}>
        <Plus size={14} className="mr-1.5" /> Thêm câu hỏi
      </Button>
    </div>
  );
}
