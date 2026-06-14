import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import RoleGuard from '../auth/RoleGuard';
import { PERMISSIONS, hasPermission } from '../auth/permissions';
import { useInventory } from '../inventory/useInventory';

export default function ItemDetailsModal({
    isOpen,
    onClose,
    item,
    user,
    onUpdateStatus,
    onDelete,
    onUpdateDescription,
}) {
    if (!item) return null;
    const { t } = useTranslation();
    const [returnDate, setReturnDate] = useState('');
    const [isDescriptionOpen, setIsDescriptionOpen] = useState(false);
    const [isEditingDescription, setIsEditingDescription] = useState(false);
    const [editedDescription, setEditedDescription] = useState('');
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [history, setHistory] = useState([]);
    
    const { getItemHistory } = useInventory(); 

useEffect(() => {
    if (isOpen) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setReturnDate(tomorrow.toISOString().split('T')[0]);

        setEditedDescription(item?.description || '');
        setIsEditingDescription(false);
    }
}, [isOpen, item]);

    if (!isOpen || !item) return null;

    const isAdmin = user?.role === 'admin';
    const isOwner = user?.name === item.owner;
    const canManage = isAdmin || isOwner;
    const canBorrow = user?.role === 'regular' || user?.role === 'admin';

    const statusStyles = {
        'dostępny': 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50',
        'wypożyczony': 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400 border-blue-200 dark:border-blue-800/50',
        'oczekuje akceptacji': 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border-amber-200 dark:border-amber-800/50',
        'uszkodzony': 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 border-rose-200 dark:border-rose-800/50',
        'zarezerwowany': 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400 border-purple-200 dark:border-purple-800/50'
    }[item.status];

    const handleRequestRental = () => {
        if (!returnDate) return;
        onUpdateStatus(item.id, 'oczekuje akceptacji', false, user.name, returnDate);
    };

    const handleDelete = () => {
        if (!window.confirm(t('itemDetailsModal.deleteConfirm'))) return;
        onDelete(item.id);
    };

    const handleSaveDescription = async () => {
        // TODO: PATCH /items/{id}
        console.log('Save description', editedDescription);

        setIsEditingDescription(false);
    };

    const handleToggleHistory = async () => {
        const nextState = !isHistoryOpen;

        setIsHistoryOpen(nextState);

        if (nextState && history.length === 0) {
            const result = await getItemHistory(item.id);

            if (result.success) {
                setHistory(result.data);
            }
        }
    };

    const renderDescription = (text) => {
    if (!text) {
        return '-';
    }

    const urlRegex = /(https?:\/\/[^\s]+)/g;

    return text.split(urlRegex).map((part, index) => {
        if (urlRegex.test(part)) {
            return (
                <a key={index} href={part} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 underline">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 015.657 5.656l-3 3a4 4 0 01-5.657-5.656m-1.414 1.414a4 4 0 01-5.657-5.656l3-3a4 4 0 015.657 5.656" />
                    </svg>
                    <span>{t('itemDetailsModal.openLink')}</span>
                </a>
            );
        }

        return <React.Fragment key={index}>{part}</React.Fragment>;
    });
};

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-900 flex justify-between items-start bg-slate-50/50 dark:bg-slate-900/20">
                    <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{t('itemDetailsModal.detailsTitle')}</div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">{item.name}</h2>
                        <div className="flex items-center space-x-3 mt-2">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusStyles}`}>
                                {item.status.toUpperCase()}
                            </span>
                            <span className="text-xs font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                                ID: {item.id}
                            </span>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1">✕</button>
                </div>

                <div className="p-6 overflow-y-auto flex-grow flex flex-col md:flex-row gap-6">
                    <div className="flex-1 space-y-6">
                        <div>
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase border-b border-slate-100 dark:border-slate-800 pb-2 mb-3">{t('itemDetailsModal.techSpec')}</h4>
                            <ul className="space-y-3 text-sm">
                                <li className="flex justify-between"><span className="text-slate-500">{t('itemDetailsModal.producer')}</span> <span className="font-medium text-slate-800 dark:text-slate-200">{item.producer}</span></li>
                                <li className="flex justify-between"><span className="text-slate-500">{t('itemDetailsModal.model')}</span> <span className="font-medium text-slate-800 dark:text-slate-200">{item.model}</span></li>
                                <li className="flex justify-between"><span className="text-slate-500">{t('itemDetailsModal.sn')}</span> <span className="font-mono text-slate-800 dark:text-slate-200">{item.serialNumber}</span></li>
                                <li className="flex justify-between"><span className="text-slate-500">{t('itemDetailsModal.category')}</span> <span className="text-slate-800 dark:text-slate-200">{item.category}</span></li>
                            </ul>

                <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-4">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setIsDescriptionOpen(prev => !prev)}
                            className="flex items-center gap-2"
                        >
                            <span className="text-slate-500 text-xs font-semibold">
                                {t('itemDetailsModal.description')}
                            </span>

                            <span className="text-slate-400 text-xs">
                                {isDescriptionOpen ? '▲' : '▼'}
                            </span>
                        </button>

                        {canManage && (
                            <button
                                type="button"
                                onClick={() => {
                                    setEditedDescription(item.description || '');
                                    setIsDescriptionOpen(true);
                                    setIsEditingDescription(true);
                                }}
                                className="text-xs text-emerald-600 hover:text-emerald-700 font-medium dark:text-emerald-400 dark:hover:text-emerald-300"
                            >
                            {t('itemDetailsModal.editDescription')}
                            </button>
                        )}
                    </div>

                    {isDescriptionOpen && (
                        <div className="mt-3">
                            {isEditingDescription ? (
                                <>
                                    <textarea
                                        rows={6}
                                        maxLength={256}
                                        value={editedDescription}
                                        onChange={(e) =>
                                            setEditedDescription(e.target.value)
                                        }
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-800 dark:text-slate-100"
                                    />

                                    <div className="flex items-center justify-between mt-2">
                                        <span className="text-xs text-slate-500">
                                            {editedDescription.length}/256
                                        </span>

                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEditedDescription(
                                                        item.description || ''
                                                    );
                                                    setIsEditingDescription(false);
                                                }}
                                                className="px-3 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                                            >
                                                {t('itemDetailsModal.cancel')}
                                            </button>

                                            <button
                                                type="button"
                                                onClick={handleSaveDescription}
                                                className="px-3 py-1 text-xs rounded bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-400 dark:text-slate-900"
                                            >
                                                {t('itemDetailsModal.save')}
                                            </button>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words">
                                    {renderDescription(item.description || '-')}
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-4">
                    <button
                        type="button"
                        onClick={handleToggleHistory}
                        className="flex items-center gap-2"
                    >
                        <span className="text-slate-500 text-xs font-semibold">
                            {t('itemDetailsModal.history')}
                        </span>

                        <span className="text-slate-400 text-xs">
                            {isHistoryOpen ? '▲' : '▼'}
                        </span>
                    </button>

                    {isHistoryOpen && (
                        <div className="mt-3 space-y-3">
                            {history.map(entry => (
                                <div
                                    key={entry.id}
                                    className="border-l-2 border-slate-200 dark:border-slate-700 pl-4 py-2"
                                >
                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                        {entry.updated_at}
                                    </div>

                                    <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                        {entry.updated_by}
                                    </div>

                                    <div className="text-sm text-slate-600 dark:text-slate-400">
                                        {entry.description}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                        </div>

                        <div>
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase border-b border-slate-100 dark:border-slate-800 pb-2 mb-3">{t('itemDetailsModal.location')}</h4>
                            <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-sm text-slate-700 dark:text-slate-300 flex items-center space-x-2">
                                <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                <span>{item.location}</span>
                            </div>
                        </div>

                        <div className="pt-4 flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-900/30 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl">
                            <svg className="w-16 h-16 text-slate-300 dark:text-slate-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-16v3m0 0h.01M4 12h2m0 0v2m-2-2v-2m4-2H4" /></svg>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('itemDetailsModal.qrCode')}</span>
                        </div>
                    </div>

                    {canManage ? (
                        <div className="flex-1 bg-slate-50 dark:bg-slate-900/80 border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-5 flex flex-col">
                            <div className="flex items-center space-x-2 mb-1">
                                <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                <h3 className="font-bold text-emerald-800 dark:text-emerald-400">{t('itemDetailsModal.ownerPanel')}</h3>
                            </div>
                            <p className="text-xs text-slate-500 mb-6">{t('itemDetailsModal.ownerDesc')}</p>

                            <div className="space-y-4 flex-grow">
                                {item.status === 'oczekuje akceptacji' && (
                                    <div className="bg-white dark:bg-slate-950 border border-amber-200 dark:border-amber-900/50 rounded-lg p-4 shadow-sm">
                                        <h4 className="font-bold text-sm text-amber-700 dark:text-amber-500 mb-1">{t('itemDetailsModal.reqPending')}</h4>
                                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">{t('itemDetailsModal.reqDesc', { borrower: item.borrower || 'Ktoś' })}</p>
                                        <div className="flex flex-col space-y-2">
                                            <button onClick={() => onUpdateStatus(item.id, 'zarezerwowany')} className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded shadow-sm transition">
                                                ✓ {t('itemDetailsModal.btnAccept')}
                                            </button>
                                            <button onClick={() => onUpdateStatus(item.id, 'dostępny', true)} className="w-full py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded transition">
                                                ✕ {t('itemDetailsModal.btnReject')}
                                            </button>
                                        </div>
                                    </div>
                                )}
                                {item.status === 'zarezerwowany' && (
                                    <div className="bg-white dark:bg-slate-950 border border-purple-200 dark:border-purple-900/50 rounded-lg p-4 shadow-sm">
                                        <h4 className="font-bold text-sm text-purple-700 dark:text-purple-500 mb-1">{t('itemDetailsModal.handover')}</h4>
                                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">{t('itemDetailsModal.handoverDesc')}</p>
                                        <button onClick={() => onUpdateStatus(item.id, 'wypożyczony')} className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded shadow-sm transition">{t('itemDetailsModal.btnGive')}</button>
                                    </div>
                                )}
                                {item.status === 'wypożyczony' && (
                                    <div className="bg-white dark:bg-slate-950 border border-blue-200 dark:border-blue-900/50 rounded-lg p-4 shadow-sm">
                                        <h4 className="font-bold text-sm text-blue-700 dark:text-blue-500 mb-1">{t('itemDetailsModal.returnPending')}</h4>
                                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">{t('itemDetailsModal.returnDesc', { borrower: item.borrower, dueDate: item.dueDate || 'Brak' })}</p>
                                        <button onClick={() => onUpdateStatus(item.id, 'dostępny', true)} className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded shadow-sm transition">{t('itemDetailsModal.btnReturn')}</button>
                                    </div>
                                )}
                                {item.status !== 'uszkodzony' && (
                                    <div className="pt-4 mt-auto">
                                        <button onClick={() => onUpdateStatus(item.id, 'uszkodzony')} className="w-full py-2 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 text-xs font-bold rounded transition">
                                            ⚠ {t('itemDetailsModal.markDamaged')}
                                        </button>
                                    </div>
                                )}
                                {isAdmin && (
                                <div className="pt-2">
                                    <button onClick={handleDelete}
                                        className="w-full py-2 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 text-xs font-bold rounded transition">
                                        {t('itemDetailsModal.deleteItem')}
                                    </button>
                                </div>
                                )}
                            </div>
                        </div>
                    ) : (!isOwner && item.status === 'dostępny' && canBorrow) ? (
                        <div className="flex-1 bg-white dark:bg-slate-950 border border-blue-200 dark:border-blue-900/50 rounded-xl p-5 flex flex-col shadow-sm">
                            <div className="flex items-center space-x-2 mb-1">
                                <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                <h3 className="font-bold text-blue-800 dark:text-blue-400">{t('itemDetailsModal.borrowPanel')}</h3>
                            </div>
                            <p className="text-xs text-slate-500 mb-6">{t('itemDetailsModal.borrowDesc')}</p>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">{t('itemDetailsModal.dateLabel')}</label>
                                    <input
                                        type="date"
                                        value={returnDate}
                                        onChange={e => setReturnDate(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-100 text-sm transition"
                                    />
                                </div>
                                <button
                                    onClick={handleRequestRental}
                                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition mt-4"
                                >
                                    {t('itemDetailsModal.btnSubmitReq')}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/20">
                            <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center mb-3">
                                <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                            </div>
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Tylko do odczytu</p>
                            <p className="text-xs text-slate-500 mt-1">{t('itemDetailsModal.readOnlyDesc', { owner: item.owner })}</p>
                        </div>
                    )}
                </div>

                <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-900/20 flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg transition">
                        {t('itemDetailsModal.close')}
                    </button>
                </div>
            </div>
        </div>
    );
}