export type AppUser = {
    id: string | number | null;
    name: string;
    role: string;
    status?: string;
};

export type InventoryItem = {
    id: string;
    name: string;
    status: string;

    category: string;
    categoryId?: number;
    categoryPath?: string;
    location: string;
    locationId?: number;
    owner: string;
    ownerId: number;
    description?: string | null;
    oldID?: string | null;
    parameters?: Record<string, unknown> | null;
    producer?: string | null;
    model?: string | null;
    serialNumber?: string | null;
    borrower?: string | null;
    dueDate?: string | null;
};
