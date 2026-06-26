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
    categoryId: number;

    location: string;
    locationId: number;

    owner: string;
    ownerId: number;

    description?: string | null;
};