import React, { useState, useMemo } from 'react';

export default function CategoryManager({ lang }) {
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

    const t = {
        PL: {
            title: 'Zarządzanie Hierarchią Kategorii',
            desc: 'Dodawaj, edytuj i usuwaj kategorie sprzętu. Struktura wspiera nieskończone zagnieżdżenie.',
            addTitle: 'Dodaj nową kategorię',
            nameLabel: 'Nazwa kategorii',
            parentLabel: 'Kategoria nadrzędna (Opcjonalnie)',
            rootLevel: '-- Kategoria Główna (Brak nadrzędnej) --',
            addBtn: 'Zapisz kategorię',
            adding: 'Zapisywanie...',
            treeTitle: 'Drzewo Kategorii',
            emptyTree: 'Brak zdefiniowanych kategorii.',
            delete: 'Usuń'
        },
        EN: {
            title: 'Category Hierarchy Management',
            desc: 'Add, edit, and remove equipment categories. The structure supports infinite nesting.',
            addTitle: 'Add New Category',
            nameLabel: 'Category Name',
            parentLabel: 'Parent Category (Optional)',
            rootLevel: '-- Root Category (None) --',
            addBtn: 'Save Category',
            adding: 'Saving...',
            treeTitle: 'Category Tree',
            emptyTree: 'No categories defined yet.',
            delete: 'Delete'
        }
    }[lang];

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

        // Symulacja opóźnienia sieciowego (np. fetch do /api/categories)
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

    // Symulacja requestu DELETE do API
    const handleDelete = (id) => {
        // W prawdziwym API, backend musiałby sprawdzić czy istnieją przedmioty przypisane do kategorii
        // Oraz czy usuwamy kaskadowo dzieci. Tutaj naiwne usunięcie węzła i jego bezpośrednich dzieci dla celów MVP.
        setCategories(prev => prev.filter(c => c.id !== id && c.parentId !== id));
    };

    // Komponent rekurencyjny renderujący pojedynczą gałąź drzewa
    const CategoryNode = ({ node, level = 0 }) => (
        <div className="flex flex-col">
            <div className={`flex items-center justify-between py-2 px-3 hover:bg-slate-50 dark:hover:bg-slate-900/30 rounded-lg group transition border border-transparent hover:border-slate-100 dark:hover:border-slate-800 ${level > 0 ? 'ml-6 border-l-slate-200 dark:border-l-slate-800' : ''}`}>
                <div className="flex items-center space-x-2">
                    {/* Wizualizacja węzła */}
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
                    {t.delete}
                </button>
            </div>

            {/* Rekurencja dla dzieci */}
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
            {/* Kolumna lewa: Formularz dodawania */}
            <div className="lg:col-span-1">
                <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-5">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-4">{t.addTitle}</h3>

                    <form onSubmit={handleAddCategory} className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">{t.nameLabel}</label>
                            <input
                                type="text"
                                required
                                value={newCatName}
                                onChange={(e) => setNewCatName(e.target.value)}
                                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-100 transition"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">{t.parentLabel}</label>
                            <select
                                value={selectedParentId}
                                onChange={(e) => setSelectedParentId(e.target.value)}
                                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-700 dark:text-slate-300 transition appearance-none"
                            >
                                <option value="">{t.rootLevel}</option>
                                {/* Do listy wyboru parenta przekazujemy tylko płaską strukturę */}
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
                                <span className="animate-pulse">{t.adding}</span>
                            ) : (
                                <span>+ {t.addBtn}</span>
                            )}
                        </button>
                    </form>
                </div>
            </div>

            {/* Kolumna prawa: Wizualizacja struktury drzewiastej */}
            <div className="lg:col-span-2">
                <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-5 h-full">
                    <div className="flex justify-between items-end mb-4">
                        <div>
                            <h3 className="font-bold text-sm text-slate-900 dark:text-white">{t.treeTitle}</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t.desc}</p>
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
                            <div className="text-center py-8 text-sm text-slate-400">{t.emptyTree}</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}