import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useInventory } from '../inventory/useInventory';
import { fetchLocationTree } from '../locations/useLocationTree';
import LocationCascadePicker from '../locations/LocationCascadePicker';

const MOCK_CATEGORIES = [
    { id: 1, name: 'Aparatura pomiarowa', parentId: null },
    { id: 2, name: 'Oscyloskopy', parentId: 1 },
    { id: 3, name: 'Generatory funkcyjne', parentId: 1 },
    { id: 4, name: 'Aparatura zasilająca', parentId: null },
    { id: 5, name: 'Zasilacze laboratoryjne', parentId: 4 },
    { id: 6, name: 'Sprzęt IT', parentId: null },
    { id: 7, name: 'Laptopy', parentId: 6 },
    { id: 8, name: 'Akcesoria i optyka', parentId: null },
];

const MOCK_USERS = [
    { id: 1, name: 'Adam Nowak' },
    { id: 2, name: 'dr inż. Jan Kowalski' },
    { id: 3, name: 'prof. dr hab. Andrzej Nowak' },
    { id: 4, name: 'Jakub Wiśniewski' },
    { id: 5, name: 'Anna Malik' },
    { id: 6, name: 'Kubuś Puchatek' },
];

export default function AddAssetModal({ isOpen, onClose, onSave }) {
    const { t } = useTranslation();
    const { createItem, isLoading, error, clearError } = useInventory();

    const [categoriesLocal, setCategoriesLocal] = useState(MOCK_CATEGORIES);
    const [locationTree, setLocationTree] = useState([]);
    const [locationPath, setLocationPath] = useState('');
    const [locationTreeError, setLocationTreeError] = useState(false);
    const [isLoadingLocations, setIsLoadingLocations] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        categoryId: MOCK_CATEGORIES[0]?.id ?? '',
        locationId: '',
        ownerId: MOCK_USERS[0]?.id ?? '',
    });
    const [isAddingCategory, setIsAddingCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryParentId, setNewCategoryParentId] = useState('');

    const indentCategories = () => {
        const result = [];
        const recurse = (parentId, depth = 0) => {
            categoriesLocal
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


    useEffect(() => {
        if (!isOpen) return;

        let cancelled = false;
        setLocationTreeError(false);
        setIsLoadingLocations(true);
        fetchLocationTree()
            .then((tree) => {
                if (!cancelled) setLocationTree(tree);
            })
            .catch(() => {
                if (!cancelled) {
                    setLocationTree([]);
                    setLocationTreeError(true);
                }
            })
            .finally(() => {
                if (!cancelled) setIsLoadingLocations(false);
            });

        return () => { cancelled = true; };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        setFormData({
            name: '',
            description: '',
            categoryId: categoriesLocal[0]?.id ?? '',
            locationId: '',
            ownerId: MOCK_USERS[0]?.id ?? '',
        });
        setLocationPath('');
        clearError();
    }, [isOpen, clearError]);

    if (!isOpen) return null;

        const handleAddCategory = () => {
        if (!newCategoryName.trim()) return;

        const newCategory = {
            id: Math.max(...categoriesLocal.map(c => c.id || 0), 0) + 1,
            name: newCategoryName.trim(),
            parentId: newCategoryParentId ? parseInt(newCategoryParentId) : null
        };

        setCategoriesLocal([...categoriesLocal, newCategory]);
        setFormData({ ...formData, categoryId: newCategory.id });
        setNewCategoryName('');
        setNewCategoryParentId('');
        setIsAddingCategory(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
                if (!formData.name.trim() || !formData.categoryId || !formData.locationId || !formData.ownerId) {
            return;
        }
            const result = await createItem({
            name: formData.name,
            categoryId: parseInt(formData.categoryId),
            locationId: parseInt(formData.locationId),
            ownerId: parseInt(formData.ownerId),
            description: formData.description || null,
        });
            if (result.success && result.statusCode === 201) {
            // Backend zwraca: { id, inventory_number, status }
            // Frontend bierze name i description z formularza
            const categoryName = categoriesLocal.find(c => c.id === parseInt(formData.categoryId))?.name || 'Unknown';
            const savedLocationPath = locationPath || 'Unknown';
            const ownerName = MOCK_USERS.find(u => u.id === parseInt(formData.ownerId))?.name || 'Unknown';
            const newAsset = {
                id: result.data.id,
                inventory_number: result.data.inventory_number,
                status: result.data.status,
                name: formData.name,
                category: categoryName,
                location: savedLocationPath,
                owner: ownerName,
                description: formData.description,
            };

            onSave(newAsset);
            onClose();
        }
    };

    return (
        <>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">

                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-900 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/20">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide">{t('addAssetModal.modalTitle')}</h2>
                    <button onClick={onClose} disabled={isLoading} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm disabled:opacity-50">
                        ✕
                    </button>
                </div>
                {error && (
                    <div className="px-6 py-3 bg-rose-50 dark:bg-rose-950/30 border-b border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-xs flex justify-between items-start">
                        <div>{error}</div>
                        <button onClick={clearError} className="text-rose-500 hover:text-rose-700">✕</button>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-grow text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                            <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1">{t('addAssetModal.name')} *</label>
                            <input 
                                type="text" 
                                required 
                                value={formData.name} 
                                onChange={e => setFormData({...formData, name: e.target.value})} 
                                disabled={isLoading}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed" 
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1">{t('addAssetModal.description')}</label>
                          <textarea 
                            rows="2"
                            maxLength={256} 
                            value={formData.description} 
                            onChange={e => setFormData({...formData, description: e.target.value})} 
                            disabled={isLoading}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-100 resize-none disabled:opacity-50 disabled:cursor-not-allowed" 
                        />
                    </div>
                    
                    <div className="flex justify-end mt-1">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                            {formData.description.length}/256
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1">{t('addAssetModal.category')} *</label>
                            <div className="flex gap-2">
                                <select 
                                    value={formData.categoryId} 
                                    onChange={e => setFormData({...formData, categoryId: e.target.value})} 
                                    disabled={isLoading}
                                    className="flex-grow px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-700 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {indentedCats.map(cat => (
                                        <option key={cat.id} value={cat.id}>
                                            {'\u00A0'.repeat(cat.depth * 3)}{cat.name}
                                        </option>
                                    ))}
                                    <option value="__add_new__" disabled>+ {t('addAssetModal.addNewCategory') || 'Dodaj nową kategorię'}</option>
                                </select>
                                <button
                                    type="button"
                                    onClick={() => setIsAddingCategory(true)}
                                    disabled={isLoading}
                                    className="px-3 py-2 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-400 text-sm font-bold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    +
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1">{t('addAssetModal.owner')} *</label>
                            <select 
                                value={formData.ownerId} 
                                onChange={e => setFormData({...formData, ownerId: e.target.value})} 
                                disabled={isLoading}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-700 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {MOCK_USERS.map(user => (
                                    <option key={user.id} value={user.id}>
                                        {user.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="border-t border-slate-100 dark:border-slate-900 pt-3">
                        <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase text-[10px] tracking-wide">{t('addAssetModal.locationTitle')}</h4>
                        {locationTreeError && (
                            <p className="text-xs text-rose-600 dark:text-rose-400 mb-2">
                                {t('addAssetModal.locationsError')}
                            </p>
                        )}
                        <LocationCascadePicker
                            key={isOpen ? 'open' : 'closed'}
                            tree={locationTree}
                            value={formData.locationId}
                            disabled={isLoading}
                            isLoading={isLoadingLocations}
                            onChange={({ locationId, locationPath: nextPath }) => {
                                setFormData((prev) => ({
                                    ...prev,
                                    locationId: locationId ? String(locationId) : '',
                                }));
                                setLocationPath(nextPath);
                            }}
                        />
                    </div>

            
                </form>
                <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-900/20 flex justify-end space-x-2 text-xs">
                    <button 
                        type="button" 
                        onClick={onClose} 
                        disabled={isLoading} 
                        className="px-4 py-2 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 font-medium rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {t('addAssetModal.cancel')}
                    </button>
                    <button 
                        type="submit" 
                        onClick={handleSubmit}
                        disabled={isLoading} 
                        className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-bold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? t('addAssetModal.saving') : t('addAssetModal.save')}
                    </button>
                </div>

            </div>
        </div>

        {isAddingCategory && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 w-full max-w-sm rounded-2xl shadow-xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-900 flex justify-between items-center">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide">{t('addAssetModal.addNewCategory')}</h3>
                        <button onClick={() => setIsAddingCategory(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm">✕</button>
                    </div>

                    <form onSubmit={(e) => { e.preventDefault(); handleAddCategory(); }} className="p-6 space-y-4">
                        <div>
                            <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1 text-xs">{t('addAssetModal.categoryName')}</label>
                            <input 
                                type="text" 
                                required 
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                placeholder={t('addAssetModal.categoryPlaceholder')}
                                autoFocus
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-100 text-xs"
                            />
                        </div>

                        <div>
                            <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1 text-xs">{t('addAssetModal.categoryParentLabel')}</label>
                            <select 
                                value={newCategoryParentId}
                                onChange={(e) => setNewCategoryParentId(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-700 dark:text-slate-300 text-xs"
                            >
                                <option value="">{t('addAssetModal.noParent')}</option>
                                {categoriesLocal.filter(c => !c.parentId).map(cat => (
                                    <option key={cat.id} value={cat.id}>
                                        {cat.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-900">
                            <button
                                type="button"
                                onClick={() => setIsAddingCategory(false)}
                                className="flex-1 px-4 py-2 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 font-medium rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition text-xs"
                            >
                                {t('addAssetModal.cancelCategory')}
                            </button>
                            <button
                                type="submit"
                                className="flex-1 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-bold rounded-lg transition text-xs"
                            >
                                {t('addAssetModal.saveCategory')}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}
        </>
    );
}