'use client';

import * as React from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Overlay>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Overlay
        ref={ref}
        className={cn(
            'fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm data-[state=open]:animate-fadeIn',
            className,
        )}
        {...props}
    />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const isSelectPortalTarget = (target: EventTarget | null) =>
    target instanceof Element && target.closest('[data-slot="select-content"]') !== null;

const DialogContent = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { showCloseButton?: boolean }
>(({ className, children, showCloseButton = true, ...props }, ref) => {
    const { t } = useTranslation();

    return (
>(({ className, children, showCloseButton = true, onInteractOutside, onPointerDownOutside, ...props }, ref) => (
        <DialogPortal>
            <DialogOverlay />
            <DialogPrimitive.Content
                ref={ref}
                className={cn(
                    'fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100',
                    className,
                )}
                onInteractOutside={(event) => {
                    if (isSelectPortalTarget(event.target)) {
                        event.preventDefault();
                    }
                    onInteractOutside?.(event);
                }}
                onPointerDownOutside={(event) => {
                    if (isSelectPortalTarget(event.target)) {
                        event.preventDefault();
                    }
                    onPointerDownOutside?.(event);
                }}
                {...props}
            >
                {children}
                {showCloseButton && (
                    <DialogPrimitive.Close asChild>
                        <Button variant="ghost" size="icon-sm" className="absolute right-3 top-3">
                            <X />
                            <span className="sr-only">{t('a11y.close')}</span>
                        </Button>
                    </DialogPrimitive.Close>
                )}
            </DialogPrimitive.Content>
        </DialogPortal>
    );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
    return <div className={cn('flex flex-col space-y-1.5 text-left', className)} {...props} />;
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
    return <div className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)} {...props} />;
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
    return <DialogPrimitive.Title className={cn('text-lg font-semibold leading-none tracking-tight', className)} {...props} />;
}

function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
    return <DialogPrimitive.Description className={cn('text-sm text-slate-500 dark:text-slate-400', className)} {...props} />;
}

export {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogOverlay,
    DialogPortal,
    DialogTitle,
    DialogTrigger,
};
