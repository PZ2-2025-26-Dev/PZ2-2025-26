export type AppUser = {
    id: string | number | null;
    name: string;
    role: string;
    status?: string;
};

export type InventoryItem = {
    id: string | number;
    inventory_number?: string;
    name: string;
    producer?: string;
    model?: string;
    serialNumber?: string;
    status: string;
    category: string;
    categoryId?: number;
    location: string;
    locationId?: number;
    owner: string;
    ownerId: number;
    borrower?: string | null;
    dueDate?: string | null;
    description?: string;
};
