import { useState, useEffect } from 'react';

/**
 * Delays updating the value by a specified amount of time.
 * The UI reacts immediately (controlled input), but the "debouncedValue"
 * updates only after `delay` ms have passed since the last change.
 *
 * @param {any} value - The value to debounce (e.g., searchQuery from state)
 * @param {number} delay - Delay time in milliseconds (default: 300)
 * @returns {any} debouncedValue - The delayed value used for API calls
 */

export function useDebounce(value, delay = 300) {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => clearTimeout(timer);
    }, [value, delay]);

    return debouncedValue;
}