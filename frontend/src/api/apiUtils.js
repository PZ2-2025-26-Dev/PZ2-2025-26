/**
 * Parsuje obiekt błędu rzucony przez Axios i wyciąga czytelny komunikat dla użytkownika.
 * Uwzględnia standardowe formaty odpowiedzi z FastAPI.
 * * @param {Error} error - Obiekt błędu złapany w bloku catch
 * @param {string} fallbackMsg - Domyślna wiadomość, gdy nie uda się odczytać błędu
 * @returns {string} Sformatowany komunikat
 */
export const parseApiError = (error, fallbackMsg = 'Wystąpił nieoczekiwany błąd serwera.') => {
    if (!error.response) {
        // Błąd sieci (np. backend leży, brak internetu)
        return 'Brak odpowiedzi z serwera. Sprawdź połączenie z siecią.';
    }

    const { status, data } = error.response;

    // Obsługa błędów autoryzacji
    if (status === 401 || status === 403) {
        return data?.detail || 'Brak wymaganych uprawnień do wykonania tej operacji.';
    }

    // Obsługa błędów walidacji z FastAPI (Pydantic ValidationError)
    if (status === 422 && Array.isArray(data?.detail)) {
        // Zwraca pierwszą niezgodność z listy walidacji
        const firstError = data.detail[0];
        return `Błąd walidacji w polu [${firstError.loc.join(' -> ')}]: ${firstError.msg}`;
    }

    // Standardowe błędy biznesowe (np. 400, 404, 409) rzucane przez HTTPException w Pythonie
    if (data && data.detail) {
        return typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
    }

    return fallbackMsg;
};