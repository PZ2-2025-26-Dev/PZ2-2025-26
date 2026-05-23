import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export default function AddAssetModal({ isOpen, onClose, onSave }) {
    const { t } = useTranslation();

    const categories = [
        { id: 'cat-1', name: 'Aparatura pomiarowa', parentId: null },
        { id: 'cat-2', name: 'Oscyloskopy', parentId: 'cat-1' },
        { id: 'cat-3', name: 'Generatory funkcyjne', parentId: 'cat-1' },
        { id: 'cat-4', name: 'Aparatura zasilająca', parentId: null },
        { id: 'cat-5', name: 'Zasilacze laboratoryjne', parentId: 'cat-4' },
        { id: 'cat-6', name: 'Sprzęt IT', parentId: null },
        { id: 'cat-7', name: 'Laptopy', parentId: 'cat-6' },
        { id: 'cat-8', name: 'Akcesoria i optyka', parentId: null },
    ];

    const indentCategories = () => {
        const result = [];
        const recurse = (parentId, depth = 0) => {
            categories
                .filter(c => c.parentId === parentId)
                .forEach(c => {
                    result.push({ ...c, depth });
                    recurse(c.id, depth + 1);
                });
        };
        recurse(null);
        return result;
    };

    const indentedCats = indentCategories();

    const [formData, setFormData] = useState({
        name: '',
        producer: '',
        model: '',
        serialNumber: '',
        description: '',
        purchaseDate: new Date().toISOString().split('T')[0],
        status: 'dostępny',
        category: 'Aparatura pomiarowa',
        building: 'D10',
        room: '',
        cabinet: '',
        owner: 'Adam Nowak'
    });

    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setFormData({
                name: '',
                producer: '',
                model: '',
                serialNumber: '',
                description: '',
                purchaseDate: new Date().toISOString().split('T')[0],
                status: 'dostępny',
                category: 'Aparatura pomiarowa',
                building: 'D10',
                room: '',
                cabinet: '',
                owner: 'Kubuś Puchatek'
            });
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.name || !formData.producer || !formData.model || !formData.serialNumber || !formData.room) return;

        setIsSubmitting(true);

        setTimeout(() => {
            const fullLocation = `Budynek ${formData.building} / Pokój ${formData.room}${formData.cabinet ? ` / Szafa ${formData.cabinet}` : ''}`;

            const newAsset = {
                id: `AGH-WFIIS-${Math.floor(1000 + Math.random() * 9000)}`,
                name: formData.name,
                producer: formData.producer,
                model: formData.model,
                serialNumber: formData.serialNumber,
                status: formData.status,
                category: formData.category,
                location: fullLocation,
                owner: formData.owner,
                description: formData.description,
                purchaseDate: formData.purchaseDate
            };

            onSave(newAsset);
            setIsSubmitting(false);
            onClose();
        }, 400);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">

                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-900 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/20">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide">{t('addAssetModal.modalTitle')}</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm">✕</button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-grow text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                            <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1">{t('addAssetModal.name')}</label>
                            <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-100" />
                        </div>
                        <div>
                            <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1">{t('addAssetModal.producer')}</label>
                            <input type="text" required value={formData.producer} onChange={e => setFormData({...formData, producer: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-100" />
                        </div>
                        <div>
                            <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1">{t('addAssetModal.model')}</label>
                            <input type="text" required value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-100" />
                        </div>
                        <div>
                            <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1">{t('addAssetModal.serialNumber')}</label>
                            <input type="text" required value={formData.serialNumber} onChange={e => setFormData({...formData, serialNumber: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-100 font-mono" />
                        </div>
                        <div>
                            <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1">{t('addAssetModal.purchaseDate')}</label>
                            <input type="date" required value={formData.purchaseDate} onChange={e => setFormData({...formData, purchaseDate: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-100" />
                        </div>
                    </div>

                    <div>
                        <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1">{t('addAssetModal.description')}</label>
                        <textarea rows="2" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-100 resize-none" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1">{t('addAssetModal.status')}</label>
                            <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-700 dark:text-slate-300">
                                <option value="dostępny">dostępny</option>
                                <option value="wypożyczony">wypożyczony</option>
                                <option value="oczekuje akceptacji">oczekuje akceptacji</option>
                                <option value="uszkodzony">uszkodzony</option>
                                <option value="zarezerwowany">zarezerwowany</option>
                            </select>
                        </div>
                        <div>
                            <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1">{t('addAssetModal.category')}</label>
                            <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-700 dark:text-slate-300">
                                {indentedCats.map(cat => (
                                    <option key={cat.id} value={cat.name}>
                                        {'\u00A0'.repeat(cat.depth * 3)}{cat.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="border-t border-slate-100 dark:border-slate-900 pt-3">
                        <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase text-[10px] tracking-wide">{t('addAssetModal.locationTitle')}</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1">{t('addAssetModal.building')}</label>
                                <select value={formData.building} onChange={e => setFormData({...formData, building: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-700 dark:text-slate-300">
                                    <option value="D10">Budynek D10</option>
                                    <option value="D11">Budynek D11</option>
                                    <option value="C3">Budynek C3</option>
                                </select>
                            </div>
                            <div>
                                <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1">{t('addAssetModal.room')}</label>
                                <input type="text" required placeholder="np. 204" value={formData.room} onChange={e => setFormData({...formData, room: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-100" />
                            </div>
                            <div>
                                <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1">{t('addAssetModal.cabinet')}</label>
                                <input type="text" placeholder="np. A" value={formData.cabinet} onChange={e => setFormData({...formData, cabinet: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-100" />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1">{t('addAssetModal.owner')}</label>
                        <input type="text" required value={formData.owner} onChange={e => setFormData({...formData, owner: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-100" />
                    </div>
                    <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-900/20 flex justify-end space-x-2 text-xs">
                        <button type="button" onClick={onClose} disabled={isSubmitting} className="px-4 py-2 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 font-medium rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition">{t('addAssetModal.cancel')}</button>
                        <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-bold rounded-lg transition disabled:opacity-50">{isSubmitting ? t('addAssetModal.saving') : t('addAssetModal.save')}</button>
                    </div>
                </form>

            </div>
        </div>
    );
}