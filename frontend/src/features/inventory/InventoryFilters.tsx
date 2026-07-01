import React, { useMemo, useState } from "react";
import { Search, Plus, Trash2, ChevronDown, ChevronUp, GripVertical, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export type Category = {
  id: number;
  name: string;
  parentId: number | null;
};

export type Location = {
  id: number;
  path: string;
};

export type User = {
  id: number;
  name: string;
};

export type InventoryFiltersState = {
  uuid: string;
  name: string;
  description: string;
  status: string;
  categoryId: string;
  locationId: string;
  ownerId: string;
  borrowerId?: string;
  search?: string;
  sort?: string; 
  page?: number;
  limit?: number;
  parameters?: Record<string, string>;
  custom_params?: string; 
};

type Props = {
  filters: InventoryFiltersState;
  onChange: (filters: InventoryFiltersState) => void;
  categories: Category[];
  locations: Location[];
  users: User[];

  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
};

interface TechParamRow {
  key: string;
  value: string;
}

interface SortCriteriaItem {
  field: string;
  order: "asc" | "desc";
  label: string;
}

// Sortable item component
function SortableItem({ item, onToggleOrder, onRemove }: {
  item: SortCriteriaItem;
  onToggleOrder: (field: string) => void;
  onRemove: (field: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.field });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-300">
        {item.label}
      </span>

      <button
        onClick={() => onToggleOrder(item.field)}
        className="p-1 text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
      >
        {item.order === "asc" ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>

      <button
        onClick={() => onRemove(item.field)}
        className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function InventoryFilters({
  filters,
  onChange,
  categories,
  locations,
  users,
  isOpen,
  setIsOpen,
}: Props) {
  const { t } = useTranslation();
  
  // Sortable columns
  const SORTABLE_COLUMNS = [
    { field: "id", labelKey: "ID" },
    { field: "name", labelKey: "dashboard.thName" },
    { field: "category", labelKey: "dashboard.tabCategories" },
    { field: "location", labelKey: "dashboard.tabLocations" },
    { field: "status", labelKey: "dashboard.thStatus" },
    { field: "owner", labelKey: "addAssetModal.owner" },
  ];

  // State for sort criteria (parsed from filters.sort)
  const [sortCriteria, setSortCriteria] = useState<SortCriteriaItem[]>(() => {
    if (!filters.sort) return [];
    return filters.sort.split(",").map((part) => {
      const [field, order] = part.split(":");
      const column = SORTABLE_COLUMNS.find((col) => col.field === field.trim());
      return {
        field: field.trim(),
        order: (order?.trim() || "asc") as "asc" | "desc",
        label: column ? t(column.labelKey) : field.trim(),
      };
    });
  });

  const [openSortPanel, setOpenSortPanel] = useState(false);

  // DnD context sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle sort drag end
  const handleSortDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = sortCriteria.findIndex((c) => c.field === active.id);
      const newIndex = sortCriteria.findIndex((c) => c.field === over.id);
      const newCriteria = arrayMove(sortCriteria, oldIndex, newIndex);
      setSortCriteria(newCriteria);
      updateFiltersSort(newCriteria);
    }
  };

  // Update filters.sort when sortCriteria changes
  const updateFiltersSort = (newCriteria: SortCriteriaItem[]) => {
    const sortString = newCriteria
      .map((c) => `${c.field}:${c.order}`)
      .join(",");
    onChange({
      ...filters,
      sort: sortString,
      page: 1,
    });
  };

  // Toggle sort order (asc <-> desc)
  const toggleSortOrder = (field: string) => {
    const newCriteria = sortCriteria.map((c) =>
      c.field === field
        ? { ...c, order: (c.order === "asc" ? "desc" : "asc") as "asc" | "desc" }
        : c
    );
    setSortCriteria(newCriteria);
    updateFiltersSort(newCriteria);
  };

  // Remove sort criterion
  const removeSortCriterion = (field: string) => {
    const newCriteria = sortCriteria.filter((c) => c.field !== field);
    setSortCriteria(newCriteria);
    updateFiltersSort(newCriteria);
  };

  // Add new sort column
  const addSortColumn = (field: string) => {
    if (sortCriteria.find((c) => c.field === field)) return; // Already added
    const column = SORTABLE_COLUMNS.find((col) => col.field === field);
    if (column) {
      const newCriteria = [
        ...sortCriteria,
        {
          field,
          order: "asc" as const,
          label: t(column.labelKey),
        },
      ];
      setSortCriteria(newCriteria);
      updateFiltersSort(newCriteria);
    }
  };

  // Available columns (not yet added to sort)
  const availableColumns = SORTABLE_COLUMNS.filter(
    (col) => !sortCriteria.find((sc) => sc.field === col.field)
  );
  
  // Dynamiczne opcje statusów korzystające z kluczy translacji
  const STATUS_OPTIONS = [
    { value: "all", label: t("inventoryFilters.options.allStatuses") },
    { value: "available", label: t("inventoryFilters.status.available") },
    { value: "reserved", label: t("inventoryFilters.status.reserved") },
    { value: "loaned", label: t("inventoryFilters.status.loaned") },
    { value: "pending_approval", label: t("inventoryFilters.status.pendingApproval") },
    { value: "broken", label: t("inventoryFilters.status.broken") },
  ];

  // Stan dla dynamicznych wierszy parametrów technicznych (JSON)
  const [techParams, setTechParams] = useState<TechParamRow[]>([
    { key: "", value: "" }
  ]);

  const indentedCategories = useMemo(() => {
    const result: Array<Category & { depth: number }> = [];

    const append = (parentId: number | null, depth = 0) => {
      categories
        .filter((category) => category.parentId === parentId)
        .forEach((category) => {
          result.push({
            ...category,
            depth,
          });

          append(category.id, depth + 1);
        });
    };

    append(null);

    return result;
  }, [categories]);

  // Obsługa zmian w dynamicznych wierszach parametrów
  // Ta funkcja zbiera tablicę [{key, value}] i tworzy string dla API
  const buildCustomParamsString = (paramsArray: TechParamRow[]): string | undefined => {
    const filledParams = paramsArray
      .filter(p => p.key.trim() !== '' && p.value.trim() !== '') // tylko wypełnione pola
      .map(p => `${p.key.trim()}:${p.value.trim()}`);
    
    return filledParams.length > 0 ? filledParams.join(',') : undefined;
  };

  // Obsługa zmiany wartości w dynamicznych polach tekstowych parametrów customowych
  const handleParamChange = (index: number, field: keyof TechParamRow, value: string) => {
    const updatedParams = [...techParams];
    updatedParams[index][field] = value;
    setTechParams(updatedParams); // Twój stan lokalny komponentu

    // Generujemy string na backend
    const customParamsString = buildCustomParamsString(updatedParams);

    // POPRAWKA: Zmiana onFiltersChange na onChange zgodnie z deklaracją komponentu
    onChange({
      ...filters,
      custom_params: customParamsString,
      page: 1,
    });
  };

  // Usuwanie kryterium z listy parametrów customowych
  const removeParamCriterion = (index: number) => {
    const updatedParams = techParams.filter((_, i) => i !== index);
    setTechParams(updatedParams);
    
    const customParamsString = buildCustomParamsString(updatedParams);
    
    // POPRAWKA: Zmiana onFiltersChange na onChange zgodnie z deklaracją komponentu
    onChange({
      ...filters,
      custom_params: customParamsString,
      page: 1,
    });
  };
  
  const addParamCriterion = () => {
    setTechParams([...techParams, { key: "", value: "" }]);
  };

  const updateFilterField = (field: keyof InventoryFiltersState, value: string) => {
    onChange({
      ...filters,
      [field]: value === "all" ? "" : value,
      page: 1,
    });
  };

  return (
    <div className="space-y-4 bg-card p-4 rounded-lg border shadow-sm">
      {/* Rozwijany panel zaawansowany */}
      <Collapsible open={isOpen}>
        <CollapsibleContent className="space-y-6 pt-4 relative">
          
          {/* SEKCJA 1: Dane urządzenia */}
          <div>
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-3">
              {t("inventoryFilters.sections.deviceData")}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="oldID">{t("inventoryFilters.fields.deviceId")}</Label>
                <Input
                  id="oldID"
                  placeholder="np. AGH-001"
                  value={filters.uuid || ""} 
                  onChange={(e) => updateFilterField("uuid", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">{t("inventoryFilters.fields.deviceName")}</Label>
                <Input
                  id="name"
                  placeholder="np. Mikroskop"
                  value={filters.name || ""}
                  onChange={(e) => updateFilterField("name", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>{t("inventoryFilters.fields.category")}</Label>
                <Select
                  value={filters.categoryId || "all"}
                  onValueChange={(val: string) => updateFilterField("categoryId", val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("inventoryFilters.placeholders.category")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("inventoryFilters.options.allCategories")}</SelectItem>
                    {indentedCategories.map((cat) => (
                      <SelectItem key={cat.id} value={String(cat.id)}>
                        {"— ".repeat(cat.depth)}
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("inventoryFilters.fields.status")}</Label>
                <Select
                  value={filters.status || "all"}
                  onValueChange={(val: string) => updateFilterField("status", val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("inventoryFilters.placeholders.status")} />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* SEKCJA 2: Parametry techniczne (Filtrowanie po JSON z item.parameters) */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
              {t("inventoryFilters.parameters.title")}
            </h3>
            
            {techParams.map((param, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="flex-1">
                  <Input
                    placeholder={t("inventoryFilters.parameters.keyPlaceholder")}
                    value={param.key}
                    onChange={(e) => handleParamChange(index, "key", e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <Input
                    placeholder={t("inventoryFilters.parameters.valuePlaceholder")}
                    value={param.value}
                    onChange={(e) => handleParamChange(index, "value", e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeParamCriterion(index)}
                  className="text-destructive hover:text-destructive/90"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addParamCriterion}
              className="flex items-center gap-1 mt-2"
            >
              <Plus className="h-4 w-4" /> {t("inventoryFilters.buttons.addParam")}
            </Button>
          </div>

          {/* SEKCJA 3: Drzewo lokalizacji */}
          <div>
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-3">
              {t("inventoryFilters.sections.locationTree")}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("inventoryFilters.fields.location")}</Label>
                <Select
                  value={filters.locationId || "all"}
                  onValueChange={(val: string) => updateFilterField("locationId", val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("inventoryFilters.placeholders.location")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {t("inventoryFilters.options.allLocations")}
                    </SelectItem>
                    {locations.map((loc) => (
                      <SelectItem key={loc.id} value={String(loc.id)}>
                        {loc.path}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* SEKCJA 4: Użytkownicy */}
          <div>
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-3">
              {t("inventoryFilters.sections.users")}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("inventoryFilters.fields.owner")}</Label>
                <Select
                  value={filters.ownerId || "all"}
                  onValueChange={(val: string) => updateFilterField("ownerId", val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("inventoryFilters.placeholders.owner")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("inventoryFilters.options.allOwners")}</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("inventoryFilters.fields.borrower")}</Label>
                <Select
                  value={filters.borrowerId || "all"}
                  onValueChange={(val: string) => updateFilterField("borrowerId", val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("inventoryFilters.placeholders.borrower")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("inventoryFilters.options.allBorrowers")}</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* SEKCJA 5: Sortowanie */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                {t("inventoryFilters.sections.sorting")}
              </h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpenSortPanel(!openSortPanel)}
                className="gap-2"
              >
                {openSortPanel ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    {t("inventoryFilters.buttons.hideSorting")}
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    {t("inventoryFilters.buttons.showSorting")}
                  </>
                )}
              </Button>
            </div>

            {openSortPanel && (
              <div className="space-y-3">
                {sortCriteria.length > 0 && (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleSortDragEnd}
                  >
                    <SortableContext
                      items={sortCriteria.map((c) => c.field)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {sortCriteria.map((item) => (
                          <SortableItem
                            key={item.field}
                            item={item}
                            onToggleOrder={toggleSortOrder}
                            onRemove={removeSortCriterion}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}

                {availableColumns.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500">
                      {t("inventoryFilters.sorting.addColumn")}
                    </Label>
                    <Select onValueChange={addSortColumn}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("inventoryFilters.sorting.selectColumn")} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableColumns.map((col) => (
                          <SelectItem key={col.field} value={col.field}>
                            {t(col.labelKey)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {sortCriteria.length === 0 && availableColumns.length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-2">
                    {t("inventoryFilters.sorting.noColumns")}
                  </p>
                )}
              </div>
            )}
          </div>


        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}