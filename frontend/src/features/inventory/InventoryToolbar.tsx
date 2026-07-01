import { useState } from "react";
import { Search, Plus, Download, SlidersHorizontal, X } from "lucide-react"; // Jeśli masz ikonę QrCode w pakiecie, możesz zmienić Search na QrCode
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import InventoryFilters, { InventoryFiltersState } from "./InventoryFilters";
import RoleGuard from "../auth/RoleGuard";
import { PERMISSIONS } from "../auth/permissions";
import { useTranslation } from 'react-i18next';

type Props = {
  user: any;

  filters: InventoryFiltersState;
  onChange: (filters: InventoryFiltersState) => void;

  categories: any[];
  locations: any[];
  users: any[];

  onAdd: () => void;
  onExport: () => void;
  onQrScan: () => void; // <-- Dodana nowa właściwość w Props

  isLoading?: boolean;
};

export default function InventoryToolbar({
  user,
  filters,
  onChange,
  categories,
  locations,
  users,
  onAdd,
  onExport,
  onQrScan, // <-- Destrukturyzacja nowej właściwości
  isLoading,
}: Props) {
  const [openFilters, setOpenFilters] = useState(false);
  const { t } = useTranslation();

  const updateSearch = (value: string) => {
    onChange({
      ...filters,
      search: value,
      page: 1,
    });
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">

        {/* TOP BAR */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">

          {/* SEARCH */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={filters.search || ""}
              onChange={(e) => updateSearch(e.target.value)}
              placeholder={t("dashboard.searchPlaceholder")}
              className="pl-9"
            />
          </div>

          {/* ACTIONS */}
          <div className="flex items-center gap-2">

            <Button
              variant={openFilters ? "secondary" : "outline"}
              size="sm"
              onClick={() => setOpenFilters((v) => !v)}
            >
              {openFilters ? (
                <>
                  <X className="size-4 mr-2" />
                  {t("inventoryFilters.labels.advancedFilters")}
                </>
              ) : (
                <>
                  <SlidersHorizontal className="size-4 mr-2" />
                  {t("inventoryFilters.labels.advancedFilters")}
                </>
              )}
            </Button>

            <RoleGuard user={user} requiredPermission={PERMISSIONS.ITEM_CREATE}>
              <Button size="sm" onClick={onAdd}>
                <Plus className="size-4 mr-2" />
                {t('dashboard.addAsset')}
              </Button>
            </RoleGuard>

            <RoleGuard user={user} requiredPermission={PERMISSIONS.SYSTEM_EXPORT}>
              <Button variant="secondary" size="sm" onClick={onExport}>
                <Download className="size-4 mr-2" />
                {t('dashboard.exportXlsx')}
              </Button>
            </RoleGuard>

            {/* Dodany przycisk skanowania QR zaraz po eksporcie */}
            <Button variant="secondary" size="sm" onClick={onQrScan}>
              <Search className="size-4 mr-2" />
              {t('qrScanner.button')}
            </Button>

          </div>
        </div>

        {/* ADVANCED FILTERS */}
        {openFilters && (
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <InventoryFilters
                filters={filters}
                onChange={onChange}
                categories={categories}
                locations={locations}
                users={users}
                isOpen={openFilters}
                setIsOpen={setOpenFilters}
            />
          </div>
        )}

      </CardContent>
    </Card>
  );
}