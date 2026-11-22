import { useEffect, useState } from 'react';
import { CircleAlert, CircleCheck, Info, LoaderCircle, TriangleAlert } from 'lucide-react';
import { Toaster as Sonner } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

/** Theo dõi lớp `.dark` trên <html> (ứng dụng tự quản lý theme, không dùng next-themes) */
function useHtmlDarkClass() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => setDark(root.classList.contains('dark')));
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

const Toaster = (props: ToasterProps) => {
  const dark = useHtmlDarkClass();

  return (
    <Sonner
      theme={dark ? 'dark' : 'light'}
      position="bottom-right"
      closeButton
      gap={10}
      offset={20}
      icons={{
        success: <CircleCheck size={17} className="text-primary" />,
        error: <CircleAlert size={17} className="text-destructive" />,
        warning: <TriangleAlert size={17} className="text-amber-500" />,
        info: <Info size={17} className="text-blue-500" />,
        loading: <LoaderCircle size={17} className="animate-spin text-muted-foreground" />,
      }}
      toastOptions={{
        unstyled: false,
        classNames: {
          toast:
            '!rounded-xl !border !border-border !bg-card !text-card-foreground !shadow-xl !font-sans !items-start !gap-2.5 !py-3.5',
          title: '!text-[13px] !font-semibold !leading-snug',
          description: '!text-xs !text-muted-foreground !leading-relaxed',
          icon: '!mt-px',
          closeButton:
            '!bg-card !border-border !text-muted-foreground hover:!text-foreground hover:!bg-muted',
          actionButton: '!bg-primary !text-primary-foreground !rounded-md !text-xs !font-semibold',
          cancelButton: '!bg-muted !text-muted-foreground !rounded-md !text-xs',
          error: '!border-destructive/30',
          success: '!border-primary/30',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
