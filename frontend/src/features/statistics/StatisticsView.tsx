import { useEffect, useState } from 'react';
import { AlertTriangle, ClipboardList, Clock, Download, PackageX, Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { StatCard } from '@/components/StatCard';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useExport } from '@/features/exports/useExport';
import { useStatistics } from './useStatistics';

export default function StatisticsView() {
    const { t } = useTranslation();
    const { stats, isLoading, error, fetchStats } = useStatistics();
    const { exportStatistics, isLoading: isExporting, error: exportError, clearError: clearExportError } = useExport();

    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    useEffect(() => {
        void fetchStats({ dateFrom, dateTo });
    }, [fetchStats, dateFrom, dateTo]);

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('statistics.title')}</h2>
                <div className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1">
                        <Label htmlFor="statistics-date-from">{t('statistics.dateFrom')}</Label>
                        <Input
                            id="statistics-date-from"
                            type="date"
                            value={dateFrom}
                            onChange={(event) => setDateFrom(event.target.value)}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="statistics-date-to">{t('statistics.dateTo')}</Label>
                        <Input
                            id="statistics-date-to"
                            type="date"
                            value={dateTo}
                            onChange={(event) => setDateTo(event.target.value)}
                        />
                    </div>
                    <Button
                        variant="outline"
                        disabled={isExporting}
                        onClick={() => void exportStatistics('pdf', { dateFrom, dateTo })}
                    >
                        <Download className="size-4" />
                        {t('statistics.exportPdf')}
                    </Button>
                    <Button
                        variant="outline"
                        disabled={isExporting}
                        onClick={() => void exportStatistics('xlsx', { dateFrom, dateTo })}
                    >
                        <Download className="size-4" />
                        {t('statistics.exportXlsx')}
                    </Button>
                </div>
            </div>

            {error && (
                <Alert variant="destructive">
                    <AlertTriangle />
                    <AlertTitle>{t('statistics.loadError')}</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {exportError && (
                <Alert variant="destructive">
                    <AlertTriangle />
                    <AlertTitle>{t('statistics.exportError')}</AlertTitle>
                    <AlertDescription className="flex items-center justify-between gap-3">
                        <span>{exportError}</span>
                        <Button variant="outline" size="sm" onClick={() => clearExportError()} aria-label={t('common.close')}>✕</Button>
                    </AlertDescription>
                </Alert>
            )}

            {isLoading || !stats ? (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                        {[0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-20" />)}
                    </div>
                    <Skeleton className="h-64" />
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                        <StatCard title={t('statistics.totalLoans')} value={stats.summary.totalLoans} icon={ClipboardList} />
                        <StatCard title={t('statistics.totalOverdue')} value={stats.summary.totalOverdue} icon={Clock} className="text-amber-600 dark:text-amber-400" />
                        <StatCard title={t('statistics.totalBroken')} value={stats.summary.totalBroken} icon={Wrench} className="text-rose-600 dark:text-rose-400" />
                        <StatCard title={t('statistics.totalMissing')} value={stats.summary.totalMissing} icon={PackageX} className="text-rose-600 dark:text-rose-400" />
                    </div>

                    <Card className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>{t('statistics.itemName')}</TableHead>
                                    <TableHead className="text-right">{t('statistics.loanCount')}</TableHead>
                                    <TableHead className="text-right">{t('statistics.overdueCount')}</TableHead>
                                    <TableHead className="text-right">{t('statistics.brokenCount')}</TableHead>
                                    <TableHead className="text-right">{t('statistics.missingCount')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {stats.items.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center text-slate-500">
                                            {t('statistics.empty')}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    stats.items.map((item) => (
                                        <TableRow key={item.itemUuid}>
                                            <TableCell>{item.itemName}</TableCell>
                                            <TableCell className="text-right">{item.loanCount}</TableCell>
                                            <TableCell className="text-right">{item.overdueCount}</TableCell>
                                            <TableCell className="text-right">{item.brokenCount}</TableCell>
                                            <TableCell className="text-right">{item.missingCount}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </Card>
                </>
            )}
        </div>
    );
}
