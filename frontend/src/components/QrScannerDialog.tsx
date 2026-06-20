import { useEffect, useRef, useState } from 'react';
import type { Html5Qrcode } from 'html5-qrcode';
import { Camera, LoaderCircle, ScanQrCode, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type QrScannerDialogProps = {
    isOpen: boolean;
    onClose: () => void;
    onScan: (decodedText: string) => void;
};

const READER_ID = 'asset-qr-reader';

export default function QrScannerDialog({
    isOpen,
    onClose,
    onScan,
}: QrScannerDialogProps) {
    const { t } = useTranslation();
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const scanHandledRef = useRef(false);
    const [isStarting, setIsStarting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        let cancelled = false;
        let scanner: Html5Qrcode | null = null;
        let stopPromise: Promise<void> | null = null;
        scanHandledRef.current = false;
        setError('');
        setIsStarting(true);

        const stopScanner = () => {
            if (!scanner) {
                return Promise.resolve();
            }

            if (stopPromise) {
                return stopPromise;
            }

            stopPromise = (async () => {
                if (scanner?.isScanning) {
                    await scanner.stop();
                }
                scanner?.clear();
            })();

            return stopPromise;
        };

        const startScanner = async () => {
            try {
                const {
                    Html5Qrcode: Html5QrcodeScanner,
                    Html5QrcodeSupportedFormats,
                } = await import('html5-qrcode');

                if (cancelled) {
                    return;
                }

                scanner = new Html5QrcodeScanner(READER_ID, {
                    formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
                    verbose: false,
                });
                scannerRef.current = scanner;

                await scanner.start(
                    { facingMode: 'environment' },
                    {
                        fps: 10,
                        qrbox: (viewfinderWidth, viewfinderHeight) => {
                            const edge = Math.floor(
                                Math.min(viewfinderWidth, viewfinderHeight) * 0.7,
                            );
                            return { width: edge, height: edge };
                        },
                    },
                    (decodedText) => {
                        if (scanHandledRef.current) {
                            return;
                        }

                        scanHandledRef.current = true;
                        onScan(decodedText);
                        void stopScanner()
                            .catch((scannerError) => {
                                console.warn('Could not stop QR scanner:', scannerError);
                            })
                            .finally(onClose);
                    },
                    undefined,
                );

                if (cancelled) {
                    await stopScanner();
                }
            } catch (scannerError) {
                if (!cancelled) {
                    console.warn('QR scanner error:', scannerError);
                    setError(t('qrScanner.cameraError'));
                }
            } finally {
                if (!cancelled) {
                    setIsStarting(false);
                }
            }
        };

        const frame = window.requestAnimationFrame(() => {
            void startScanner();
        });

        return () => {
            cancelled = true;
            window.cancelAnimationFrame(frame);

            void (async () => {
                try {
                    await stopScanner();
                } catch (scannerError) {
                    console.warn('Could not stop QR scanner:', scannerError);
                } finally {
                    if (scanner && scannerRef.current === scanner) {
                        scannerRef.current = null;
                    }
                }
            })();
        };
    }, [isOpen, onClose, onScan, t]);

    if (!isOpen) {
        return null;
    }

    return (
        <div
            className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-slate-950/70 px-3 py-5 backdrop-blur-sm sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="qr-scanner-title"
        >
            <div className="my-auto w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
                <div className="relative flex items-start justify-center border-b border-slate-100 px-12 py-4 text-center dark:border-slate-800 sm:justify-between sm:px-5 sm:text-left">
                    <div className="min-w-0">
                        <div className="flex items-center justify-center gap-2 sm:justify-start">
                            <ScanQrCode className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                            <h2
                                id="qr-scanner-title"
                                className="text-sm font-bold text-slate-900 dark:text-white"
                            >
                                {t('qrScanner.title')}
                            </h2>
                        </div>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {t('qrScanner.description')}
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 sm:right-4 sm:top-4"
                        aria-label={t('qrScanner.close')}
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="p-3 sm:p-5">
                    <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-xl border border-slate-200 bg-slate-950 dark:border-slate-800">
                        <div
                            id={READER_ID}
                            className="h-full min-h-[16rem] w-full overflow-hidden [&_canvas]:mx-auto [&_video]:h-full [&_video]:min-h-[16rem] [&_video]:w-full [&_video]:object-cover"
                        />

                        {isStarting && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950 text-slate-200">
                                <LoaderCircle className="h-8 w-8 animate-spin text-emerald-500" />
                                <span className="text-xs font-medium">
                                    {t('qrScanner.starting')}
                                </span>
                            </div>
                        )}

                        {error && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950 px-6 text-center">
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/15 text-rose-400">
                                    <Camera className="h-6 w-6" />
                                </div>
                                <p className="text-sm font-medium text-rose-300">
                                    {error}
                                </p>
                                <p className="text-xs text-slate-400">
                                    {t('qrScanner.permissionHint')}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-3 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
                    {t('qrScanner.hint')}
                </div>
            </div>
        </div>
    );
}
