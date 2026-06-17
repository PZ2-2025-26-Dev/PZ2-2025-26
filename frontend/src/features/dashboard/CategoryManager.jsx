import  { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

export default function CategoryManager() {
    const { t } = useTranslation();

    const [categories, setCategories] = useState([
        { id: 'cat-1', name: 'Aparatura pomiarowa', parentId: null },
        { id: 'cat-2', name: 'Oscyloskopy', parentId: 'cat-1' },
        { id: 'cat-3', name: 'Generatory funkcyjne', parentId: 'cat-1' },
        { id: 'cat-4', name: 'Aparatura zasilająca', parentId: null },
        { id: 'cat-5', name: 'Zasilacze laboratoryjne', parentId: 'cat-4' },
        { id: 'cat-6', name: 'Sprzęt IT', parentId: null },
        { id: 'cat-7', name: 'Laptopy', parentId: 'cat-6' },
        { id: 'cat-8', name: 'Akcesoria i optyka', parentId: null },
    ]);

    const [newCatName, setNewCatName] = useState('');
    const [selectedParentId, setSelectedParentId] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const categoryTree = useMemo(() => {
        const tree = [];
        const lookup = {};

        categories.forEach(cat => {
            lookup[cat.id] = { ...cat, children: [] };
        });

        categories.forEach(cat => {
            if (cat.parentId && lookup[cat.parentId]) {
                lookup[cat.parentId].children.push(lookup[cat.id]);
            } else {
                tree.push(lookup[cat.id]);
            }
        });

        return tree;
    }, [categories]);

    const handleAddCategory = (e) => {
        e.preventDefault();
        if (!newCatName.trim()) return;

        setIsSubmitting(true);

        setTimeout(() => {
            const newCategory = {
                id: `cat-${Date.now()}`,
                name: newCatName.trim(),
                parentId: selectedParentId || null
            };

            setCategories([...categories, newCategory]);
            setNewCatName('');
            setSelectedParentId('');
            setIsSubmitting(false);
        }, 400);
    };

    const handleDelete = (id) => {
        setCategories(prev => prev.filter(c => c.id !== id && c.parentId !== id));
    };

    const CategoryNode = ({ node, level = 0 }) => (
        <div className="flex flex-col">
            <div className={`flex items-center justify-between py-2 px-3 hover:bg-slate-50 dark:hover:bg-slate-900/30 rounded-lg group transition border border-transparent hover:border-slate-100 dark:hover:border-slate-800 ${level > 0 ? 'ml-6 border-l-slate-200 dark:border-l-slate-800' : ''}`}>
                <div className="flex items-center space-x-2">
                    <div className="text-slate-300 dark:text-slate-600">
                        {node.children.length > 0 ? (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        )}
                    </div>
                    <span className={`text-sm ${level === 0 ? 'font-semibold text-slate-800 dark:text-slate-200' : 'text-slate-600 dark:text-slate-400'}`}>
                        {node.name}
                    </span>
                </div>
                <button
                    onClick={() => handleDelete(node.id)}
                    className="text-[10px] uppercase font-bold text-rose-500 opacity-0 group-hover:opacity-100 transition px-2 py-1 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded"
                >
                    {t('categoryManager.delete')}
                </button>
            </div>

            {node.children.length > 0 && (
                <div className="border-l border-slate-100 dark:border-slate-800/60 ml-[21px] mt-1 space-y-1">
                    {node.children.map(child => (
                        <CategoryNode key={child.id} node={child} level={level + 1} />
                    ))}
                </div>
            )}
        </div>
    );

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
            <div className="lg:col-span-1">
                <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-5">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-4">{t('categoryManager.addTitle')}</h3>

                    <form onSubmit={handleAddCategory} className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">{t('categoryManager.nameLabel')}</label>
                            <input
                                type="text"
                                required
                                value={newCatName}
                                onChange={(e) => setNewCatName(e.target.value)}
                                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-100 transition"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">{t('categoryManager.parentLabel')}</label>
                            <select
                                value={selectedParentId}
                                onChange={(e) => setSelectedParentId(e.target.value)}
                                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-700 dark:text-slate-300 transition appearance-none"
                            >
                                <option value="">{t('categoryManager.rootLevel')}</option>
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                            </select>
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full py-2 bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition disabled:opacity-50 flex justify-center items-center"
                        >
                            {isSubmitting ? (
                                <span className="animate-pulse">{t('categoryManager.adding')}</span>
                            ) : (
                                <span>+ {t('categoryManager.addBtn')}</span>
                            )}
                        </button>
                    </form>
                </div>
            </div>

            <div className="lg:col-span-2">
                <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-5 h-full">
                    <div className="flex justify-between items-end mb-4">
                        <div>
                            <h3 className="font-bold text-sm text-slate-900 dark:text-white">{t('categoryManager.treeTitle')}</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('categoryManager.desc')}</p>
                        </div>
                    </div>

                    <div className="bg-slate-50/50 dark:bg-slate-900/20 rounded-lg border border-slate-100 dark:border-slate-800/60 p-4">
                        {categoryTree.length > 0 ? (
                            <div className="space-y-1">
                                {categoryTree.map(rootNode => (
                                    <CategoryNode key={rootNode.id} node={rootNode} />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-sm text-slate-400">{t('categoryManager.emptyTree')}</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}