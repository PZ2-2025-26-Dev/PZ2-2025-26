export const BATCH_LABEL_LIMIT = 100;

export const BATCH_LABEL_DIMENSIONS = {
    width: {
        default: 76.2,
        min: 20,
        max: 200,
    },
    height: {
        default: 30.48,
        min: 10,
        max: 150,
    },
} as const;

export const DEFAULT_BATCH_LABEL_FIELDS = ['name', 'category', 'location'];

export const BASE_BATCH_LABEL_FIELDS = [
    'name',
    'description',
    'status',
    'category',
    'location',
    'owner',
    'oldID',
];
