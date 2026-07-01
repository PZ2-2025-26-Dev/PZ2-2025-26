import React, { useMemo, useState } from "react";
import { Search, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
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

        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}