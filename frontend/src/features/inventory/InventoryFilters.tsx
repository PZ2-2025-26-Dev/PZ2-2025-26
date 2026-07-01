import React, { useMemo, useState } from "react";
import { Search, Plus, Trash2, ChevronDown, ChevronUp, GripVertical } from "lucide-react";
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

// Sortable item component (Usunięto przycisk usuwania X, ponieważ wszystkie kolumny są stałe)
function SortableItem({ item, onToggleOrder }: {
  item: SortCriteriaItem;
  onToggleOrder: (field: string) => void;
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
      className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800"
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
  
  // Definicja wszystkich dostępnych kolumn
  const SORTABLE_COLUMNS = [
    { field: "id", labelKey: "ID" },
    { field: "name", labelKey: "dashboard.thName" },
    { field: "category", labelKey: "dashboard.tabCategories" },
    { field: "location", labelKey: "dashboard.tabLocations" },
    { field: "status", labelKey: "dashboard.thStatus" },
    { field: "owner", labelKey: "addAssetModal.owner" },
  ];

  // NOWA LOGIKA: Budowanie kompletnej listy kryteriów
  const [sortCriteria, setSortCriteria] = useState<SortCriteriaItem[]>(() => {
    const activeCriteria: SortCriteriaItem[] = [];
    const activeFields = new Set<string>();

    // 1. Wyciągamy to co dostaliśmy z nadrzędnego elementu (filters.sort) i wrzucamy na górę
    if (filters.sort) {
      filters.sort.split(",").forEach((part) => {
        const [field, order] = part.split(":");
        const trimmedField = field.trim();
        const column = SORTABLE_COLUMNS.find((col) => col.field === trimmedField);
        
        if (column) {
          activeCriteria.push({
            field: trimmedField,
            order: (order?.trim() || "asc") as "asc" | "desc",
            label: t(column.labelKey),
          });
          activeFields.add(trimmedField);
        }
      });
    }
    
    // 2. Resztę brakujących kolumn uzupełniamy pod spodem w dowolnej kolejności
    SORTABLE_COLUMNS.forEach((col) => {
      if (!activeFields.has(col.field)) {
        activeCriteria.push({
          field: col.field,
          order: "asc",
          label: t(col.labelKey),
        });
      }
    });

    return activeCriteria;
  });

  // Wymuszenie aktualizacji propsów nadrzędnych przy inicjalizacji, jeśli to konieczne
  React.useEffect(() => {
    if (!filters.sort && sortCriteria.length > 0) {
      updateFiltersSort(sortCriteria);
    }
  }, []);

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
  const buildCustomParamsString = (paramsArray: TechParamRow[]): string | undefined => {
    const filledParams = paramsArray
      .filter(p => p.key.trim() !== '' && p.value.trim() !== '')
      .map(p => `${p.key.trim()}:${p.value.trim()}`);
    
    return filledParams.length > 0 ? filledParams.join(',') : undefined;
  };

  // Obsługa zmiany wartości w dynamicznych polach tekstowych parametrów customowych
  const handleParamChange = (index: number, field: keyof TechParamRow, value: string) => {
    const updatedParams = [...techParams];
    updatedParams[index][field] = value;
    setTechParams(updatedParams);

    const customParamsString = buildCustomParamsString(updatedParams);

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
    <div className="space-y-4 p-4 rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
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

          {/* SEKCJA 2: Parametry techniczne */}
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

          {/* SEKCJA 5: Sortowanie (Usunięto przycisk chowający panel oraz dropdown dodawania) */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
              {t("inventoryFilters.sections.sorting")}
            </h3>
            
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
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>

        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}