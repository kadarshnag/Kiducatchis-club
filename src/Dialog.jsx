import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, HelpCircle, Trash2, X } from 'lucide-react';

const DialogContext = createContext(null);

export const useDialog = () => {
    const ctx = useContext(DialogContext);
    if (!ctx) {
        // Fallback if rendered outside provider (e.g. testing)
        return {
            confirm: (opts) => Promise.resolve(window.confirm(typeof opts === 'string' ? opts : (opts.message || opts.title))),
            alert: (opts) => {
                window.alert(typeof opts === 'string' ? opts : (opts.message || opts.title));
                return Promise.resolve();
            }
        };
    }
    return ctx;
};

export function DialogProvider({ children }) {
    const [dialog, setDialog] = useState(null);
    const confirmButtonRef = useRef(null);

    const closeDialog = useCallback((result) => {
        if (dialog?.resolve) {
            dialog.resolve(result);
        }
        setDialog(null);
    }, [dialog]);

    const confirm = useCallback((options) => {
        return new Promise((resolve) => {
            const opts = typeof options === 'string' ? { message: options } : (options || {});
            const isDanger = opts.danger !== undefined ? Boolean(opts.danger) : true;
            setDialog({
                isOpen: true,
                isConfirm: true,
                title: opts.title || (isDanger ? 'Confirm Deletion' : 'Are you sure?'),
                message: opts.message || '',
                confirmText: opts.confirmText || (isDanger ? 'DELETE' : 'CONFIRM'),
                cancelText: opts.cancelText || 'CANCEL',
                danger: isDanger,
                type: opts.type || (isDanger ? 'danger' : 'confirm'),
                resolve
            });
        });
    }, []);

    const alert = useCallback((options) => {
        return new Promise((resolve) => {
            const opts = typeof options === 'string' ? { message: options } : (options || {});
            const isDanger = opts.danger || opts.type === 'error';
            setDialog({
                isOpen: true,
                isConfirm: false,
                title: opts.title || (opts.type === 'error' ? 'Notice' : opts.type === 'warning' ? 'Notice' : 'Information'),
                message: opts.message || '',
                confirmText: opts.buttonText || opts.confirmText || 'GOT IT',
                cancelText: '',
                danger: isDanger,
                type: opts.type || (isDanger ? 'danger' : 'info'),
                resolve: () => resolve()
            });
        });
    }, []);

    // Manage Escape / Enter keys and scroll lock
    useEffect(() => {
        if (!dialog) return;

        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeDialog(false);
            } else if (e.key === 'Enter' && !e.shiftKey) {
                // If user hits enter outside of a cancel button, confirm
                if (document.activeElement?.classList?.contains('inweb-dialog-cancel')) {
                    return; // Let native click on cancel fire
                }
                e.preventDefault();
                closeDialog(true);
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        // Autofocus confirm button
        const timer = setTimeout(() => {
            confirmButtonRef.current?.focus?.();
        }, 30);

        return () => {
            document.body.style.overflow = originalOverflow;
            window.removeEventListener('keydown', handleKeyDown);
            clearTimeout(timer);
        };
    }, [dialog, closeDialog]);

    // Choose appropriate icon
    const renderIcon = () => {
        if (!dialog) return null;
        if (dialog.danger || dialog.type === 'danger') {
            return <Trash2 size={26} strokeWidth={2.2} />;
        }
        if (dialog.type === 'warning' || dialog.type === 'error') {
            return <AlertTriangle size={26} strokeWidth={2.2} />;
        }
        if (dialog.type === 'success') {
            return <CheckCircle2 size={26} strokeWidth={2.2} />;
        }
        return <HelpCircle size={26} strokeWidth={2.2} />;
    };

    return (
        <DialogContext.Provider value={{ confirm, alert }}>
            {children}
            {dialog && (
                <div
                    className="inweb-dialog-shade"
                    onMouseDown={(e) => {
                        if (e.target === e.currentTarget) {
                            closeDialog(false);
                        }
                    }}
                    role="presentation"
                >
                    <div
                        className={`inweb-dialog-card inweb-dialog-${dialog.type} ${dialog.danger ? 'is-danger' : ''}`}
                        role="alertdialog"
                        aria-modal="true"
                        aria-labelledby="inweb-dialog-title"
                        aria-describedby="inweb-dialog-desc"
                    >
                        <button
                            type="button"
                            className="inweb-dialog-close"
                            onClick={() => closeDialog(false)}
                            aria-label="Close dialog"
                        >
                            <X size={18} />
                        </button>

                        <div className="inweb-dialog-badge" aria-hidden="true">
                            {renderIcon()}
                        </div>

                        <div className="inweb-dialog-content">
                            <h3 id="inweb-dialog-title">{dialog.title}</h3>
                            {dialog.message && (
                                <p id="inweb-dialog-desc">
                                    {dialog.message.split('\n').map((line, idx) => (
                                        <React.Fragment key={idx}>
                                            {line}
                                            {idx < dialog.message.split('\n').length - 1 && <br />}
                                        </React.Fragment>
                                    ))}
                                </p>
                            )}
                        </div>

                        <div className="inweb-dialog-actions">
                            {dialog.isConfirm && (
                                <button
                                    type="button"
                                    className="btn btn-secondary inweb-dialog-cancel"
                                    onClick={() => closeDialog(false)}
                                >
                                    {dialog.cancelText}
                                </button>
                            )}
                            <button
                                ref={confirmButtonRef}
                                type="button"
                                className={`btn ${dialog.danger ? 'btn-danger' : 'btn-primary'} inweb-dialog-confirm`}
                                onClick={() => closeDialog(true)}
                            >
                                {dialog.confirmText}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </DialogContext.Provider>
    );
}

export default DialogProvider;
