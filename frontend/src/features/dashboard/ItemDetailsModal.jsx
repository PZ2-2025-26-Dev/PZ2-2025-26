import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PERMISSIONS, ROLES, hasPermission } from '../auth/permissions';
import { useInventory } from '../inventory/useInventory';
import { useGuests } from '../guests/useGuests';
import { useRentals } from '../rentals/useRentals';
import {
    ITEM_STATUS,
    getItemStatusLabel,
    getStatusBadgeClass,
    isApiItemId,
    normalizeItemStatus,
} from '../../utils/itemStatus';

const getGuestLabel = (guest) => `${guest.firstName} ${guest.lastName}`.trim() || guest.email || `#${guest.id}`;

const resolveOwner = (item) => {
    if (typeof item.owner === 'object' && item.owner !== null) {
        return { id: item.owner.id, name: item.owner.name };
    }
    return { id: item.ownerId, name: item.owner };
};

export default function ItemDetailsModal({ isOpen, onClose, item, user, onUpdateStatus, onLoanChange }) {
    const { t } = useTranslation();
    const { getItemHistory } = useInventory();
    const { listGuests } = useGuests();
    const { registerLoan, listLoans, returnLoan, isLoading: isLoanLoading, error: loanError, clearError: clearLoanError } = useRentals();

    const [returnDate, setReturnDate] = useState('');
    const [loanPurpose, setLoanPurpose] = useState('');
    const [selectedGuestId, setSelectedGuestId] = useState('');
    const [guests, setGuests] = useState([]);
    const [activeLoan, setActiveLoan] = useState(null);
    const [loanHistory, setLoanHistory] = useState([]);
    const [actionMessage, setActionMessage] = useState('');

    const [isDescriptionOpen, setIsDescriptionOpen] = useState(false);
    const [isEditingDescription, setIsEditingDescription] = useState(false);
    const [editedDescription, setEditedDescription] = useState('');
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [history, setHistory] = useState([]);

    const apiItem = item && isApiItemId(item.id);
    const itemStatus = item ? normalizeItemStatus(item.status) : null;

    const owner = item ? resolveOwner(item) : { id: null, name: '' };
    const isOwner = user?.id === owner.id
        || user?.name === owner.name
        || hasPermission(user, PERMISSIONS.SYSTEM_MANAGE);
    const canRegisterExternalLoan = user?.role === ROLES.USER || user?.role === ROLES.ADMIN;

    const loadLoanData = useCallback(async () => {
        if (!item || !apiItem) return;

        const [guestsResult, loansResult] = await Promise.all([
            listGuests({ limit: 100 }),
            listLoans({ itemId: Number(item.id), limit: 50 }),
        ]);

        if (guestsResult.success) {
            setGuests(guestsResult.guests);
        }

        if (loansResult.success) {
            setLoanHistory(loansResult.loans);
            const active = loansResult.loans.find((loan) => loan.status === 'active');
            setActiveLoan(active ?? null);
        }
    }, [apiItem, item, listGuests, listLoans]);

    useEffect(() => {
        if (!isOpen || !item) return;

        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setReturnDate(tomorrow.toISOString().split('T')[0]);
        setLoanPurpose('');
        setSelectedGuestId('');
        setActionMessage('');
        setEditedDescription(item.description || '');
        setIsEditingDescription(false);
        setHistory([]);
        setIsHistoryOpen(false);
        clearLoanError();

        if (apiItem) {
            loadLoanData();
        } else {
            setGuests([]);
            setActiveLoan(null);
            setLoanHistory([]);
        }
    }, [isOpen, item, apiItem, loadLoanData, clearLoanError]);

    if (!isOpen || !item) return null;

    const statusLabel = getItemStatusLabel(item.status, t);
    const statusStyles = getStatusBadgeClass(item.status);

    const handleRegisterExternalLoan = async () => {
        if (!selectedGuestId || !returnDate) return;

        clearLoanError();
        setActionMessage('');

        const result = await registerLoan({
            itemId: Number(item.id),
            borrowerId: Number(selectedGuestId),
            declaredReturnDate: `${returnDate}T23:59:59`,
            loanPurpose: loanPurpose || null,
        });

        if (!result.success) {
            setActionMessage(result.error);
            return;
        }

        const guest = guests.find((g) => g.id === Number(selectedGuestId));
        const guestName = guest ? getGuestLabel(guest) : `#${selectedGuestId}`;

        setActionMessage(t('rentals.registerSuccess'));
        setActiveLoan(result.data);

        onLoanChange?.(item.id, {
            status: ITEM_STATUS.LOANED,
            borrower: guestName,
            dueDate: returnDate,
            activeLoan: result.data,
        });

        await loadLoanData();
    };

    const handleReturnLoan = async () => {
        if (!activeLoan) return;

        clearLoanError();
        setActionMessage('');

        const result = await returnLoan(activeLoan.id);
        if (!result.success) {
            setActionMessage(result.error);
            return;
        }

        setActionMessage(t('rentals.returnSuccess'));
        setActiveLoan(null);

        onLoanChange?.(item.id, {
            status: ITEM_STATUS.AVAILABLE,
            borrower: null,
            dueDate: null,
            activeLoan: null,
        });

        await loadLoanData();
    };

    const handleSaveDescription = async () => {
        setIsEditingDescription(false);
    };

    const handleToggleHistory = async () => {
        const nextState = !isHistoryOpen;
        setIsHistoryOpen(nextState);

        if (nextState && history.length === 0 && apiItem) {
            const result = await getItemHistory(item.id);
            if (result.success) {
                setHistory(result.data);
            }
        }
    };

    const renderDescription = (text) => {
        if (!text) return '-';

        const urlRegex = /(https?:\/\/[^\s]+)/g;

        return text.split(urlRegex).map((part, index) => {
            if (urlRegex.test(part)) {
                return (
                    <a key={index} href={part} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 underline">
                        <span>{t('itemDetailsModal.openLink')}</span>
                    </a>
                );
            }
            return <React.Fragment key={index}>{part}</React.Fragment>;
        });
    };

    const renderOwnerPanel = () => (
        <div className="flex-1 bg-slate-50 dark:bg-slate-900/80 border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-4 sm:p-5 flex flex-col">
            <div className="flex items-center space-x-2 mb-1">
                <h3 className="font-bold text-emerald-800 dark:text-emerald-400">{t('itemDetailsModal.ownerPanel')}</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">{t('itemDetailsModal.ownerDesc')}</p>

            {!apiItem && (
                <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-lg p-3 mb-4">
                    {t('itemDetailsModal.apiItemRequired')}
                </p>
            )}

            {(loanError || actionMessage) && (
                <p className={`text-xs mb-4 rounded-lg px-3 py-2 ${loanError ? 'text-rose-600 bg-rose-50 dark:bg-rose-950/30' : 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30'}`}>
                    {loanError || actionMessage}
                </p>
            )}

            <div className="space-y-4 flex-grow">
                {apiItem && canRegisterExternalLoan && itemStatus === ITEM_STATUS.AVAILABLE && (
                    <div className="bg-white dark:bg-slate-950 border border-emerald-200 dark:border-emerald-900/50 rounded-lg p-4 shadow-sm space-y-3">
                        <h4 className="font-bold text-sm text-emerald-700 dark:text-emerald-400">{t('rentals.panelTitle')}</h4>
                        <p className="text-xs text-slate-500">{t('rentals.panelDesc')}</p>

                        <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">{t('rentals.guestLabel')}</label>
                            <select
                                value={selectedGuestId}
                                onChange={(e) => setSelectedGuestId(e.target.value)}
                                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg"
                            >
                                <option value="">{t('rentals.selectGuest')}</option>
                                {guests.map((guest) => (
                                    <option key={guest.id} value={guest.id}>{getGuestLabel(guest)}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">{t('rentals.dueDateLabel')}</label>
                            <input
                                type="date"
                                value={returnDate}
                                onChange={(e) => setReturnDate(e.target.value)}
                                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">{t('rentals.purposeLabel')}</label>
                            <input
                                type="text"
                                value={loanPurpose}
                                onChange={(e) => setLoanPurpose(e.target.value)}
                                maxLength={512}
                                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={handleRegisterExternalLoan}
                            disabled={isLoanLoading || !selectedGuestId || !returnDate}
                            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg disabled:opacity-50"
                        >
                                {isLoanLoading ? t('userManager.loading') : t('rentals.submitBtn')}
                        </button>
                    </div>
                )}

                {apiItem && itemStatus === ITEM_STATUS.LOANED && activeLoan && (
                    <div className="bg-white dark:bg-slate-950 border border-blue-200 dark:border-blue-900/50 rounded-lg p-4 shadow-sm space-y-3">
                        <h4 className="font-bold text-sm text-blue-700 dark:text-blue-500">{t('itemDetailsModal.returnPending')}</h4>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                            {t('itemDetailsModal.externalLoanDesc', {
                                guest: guests.find((g) => g.id === activeLoan.borrower_id)
                                    ? getGuestLabel(guests.find((g) => g.id === activeLoan.borrower_id))
                                    : `#${activeLoan.borrower_id}`,
                                dueDate: activeLoan.declared_return_date?.slice(0, 10) ?? '—',
                            })}
                        </p>
                        <button
                            type="button"
                            onClick={handleReturnLoan}
                            disabled={isLoanLoading}
                            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg disabled:opacity-50"
                        >
                            {isLoanLoading ? t('userManager.loading') : t('rentals.returnBtn')}
                        </button>
                    </div>
                )}

                {apiItem && loanHistory.length > 0 && (
                    <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">{t('rentals.historyTitle')}</h4>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                            {loanHistory.map((loan) => (
                                <div key={loan.id} className="text-xs border-l-2 border-slate-200 dark:border-slate-700 pl-3 py-1">
                                    <span className="font-medium text-slate-700 dark:text-slate-300">
                                        {loan.status === 'active' ? t('rentals.statusActive') : t('rentals.statusReturned')}
                                    </span>
                                    <span className="text-slate-400 ml-2">
                                        {loan.created_at?.slice(0, 10)} → {loan.declared_return_date?.slice(0, 10)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {itemStatus !== ITEM_STATUS.BROKEN && onUpdateStatus && (
                    <div className="pt-4 mt-auto">
                        <button
                            type="button"
                            onClick={() => onUpdateStatus(item.id, ITEM_STATUS.BROKEN)}
                            className="w-full py-2 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 text-xs font-bold rounded transition"
                        >
                            ⚠ {t('itemDetailsModal.markDamaged')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="px-4 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-900 flex justify-between items-start bg-slate-50/50 dark:bg-slate-900/20">
                    <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{t('itemDetailsModal.detailsTitle')}</div>
                        <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white leading-tight">{item.name}</h2>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusStyles}`}>
                                {statusLabel.toUpperCase()}
                            </span>
                            <span className="text-xs font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                                ID: {item.id}
                            </span>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1">✕</button>
                </div>

                <div className="p-4 sm:p-6 overflow-y-auto flex-grow flex flex-col md:flex-row gap-6">
                    <div className="flex-1 space-y-6">
                        <div>
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase border-b border-slate-100 dark:border-slate-800 pb-2 mb-3">{t('itemDetailsModal.techSpec')}</h4>
                            <ul className="space-y-3 text-sm">
                                {item.producer && (
                                    <li className="flex justify-between"><span className="text-slate-500">{t('itemDetailsModal.producer')}</span> <span className="font-medium text-slate-800 dark:text-slate-200">{item.producer}</span></li>
                                )}
                                {item.model && (
                                    <li className="flex justify-between"><span className="text-slate-500">{t('itemDetailsModal.model')}</span> <span className="font-medium text-slate-800 dark:text-slate-200">{item.model}</span></li>
                                )}
                                {item.serialNumber && (
                                    <li className="flex justify-between"><span className="text-slate-500">{t('itemDetailsModal.sn')}</span> <span className="font-mono text-slate-800 dark:text-slate-200">{item.serialNumber}</span></li>
                                )}
                                <li className="flex justify-between"><span className="text-slate-500">{t('itemDetailsModal.category')}</span> <span className="text-slate-800 dark:text-slate-200">{typeof item.category === 'object' ? item.category?.name : item.category}</span></li>
                            </ul>

                            <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-4">
                                <button type="button" onClick={() => setIsDescriptionOpen((prev) => !prev)} className="flex items-center gap-2">
                                    <span className="text-slate-500 text-xs font-semibold">{t('itemDetailsModal.description')}</span>
                                    <span className="text-slate-400 text-xs">{isDescriptionOpen ? '▲' : '▼'}</span>
                                </button>
                                {isDescriptionOpen && (
                                    <div className="mt-3 text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words">
                                        {renderDescription(item.description || '-')}
                                    </div>
                                )}
                            </div>

                            {apiItem && (
                                <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-4">
                                    <button type="button" onClick={handleToggleHistory} className="flex items-center gap-2">
                                        <span className="text-slate-500 text-xs font-semibold">{t('itemDetailsModal.history')}</span>
                                        <span className="text-slate-400 text-xs">{isHistoryOpen ? '▲' : '▼'}</span>
                                    </button>
                                    {isHistoryOpen && (
                                        <div className="mt-3 space-y-3">
                                            {history.length > 0 ? history.map((entry) => (
                                                <div key={entry.id} className="border-l-2 border-slate-200 dark:border-slate-700 pl-4 py-2">
                                                    <div className="text-xs text-slate-500">{entry.updated_at}</div>
                                                    <div className="text-sm text-slate-600 dark:text-slate-400">{entry.description}</div>
                                                </div>
                                            )) : (
                                                <p className="text-xs text-slate-400">{t('itemDetailsModal.noHistory')}</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div>
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase border-b border-slate-100 dark:border-slate-800 pb-2 mb-3">{t('itemDetailsModal.location')}</h4>
                            <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-sm text-slate-700 dark:text-slate-300">
                                {typeof item.location === 'object' ? item.location?.path : item.location}
                            </div>
                        </div>
                    </div>

                    {isOwner && canRegisterExternalLoan ? renderOwnerPanel() : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/20">
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('itemDetailsModal.readOnly')}</p>
                            <p className="text-xs text-slate-500 mt-1">{t('itemDetailsModal.readOnlyDesc', { owner: owner.name })}</p>
                        </div>
                    )}
                </div>

                <div className="px-4 sm:px-6 py-3 border-t border-slate-100 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-900/20 flex justify-end">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg transition">
                        {t('itemDetailsModal.close')}
                    </button>
                </div>
            </div>
        </div>
    );
}
