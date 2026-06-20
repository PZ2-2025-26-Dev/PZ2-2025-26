class CategoryError(ValueError):
    """Base category domain error."""


class CategoryNotFoundError(CategoryError):
    """Raised when a category does not exist."""


class CategoryDuplicateNameError(CategoryError):
    """Raised when a sibling category already uses the requested name."""


class CategoryParentCycleError(CategoryError):
    """Raised when a parent change would create a category cycle."""


class CategoryHasChildrenError(CategoryError):
    """Raised when deleting a category that still has children."""


class CategoryReplacementError(CategoryError):
    """Raised when delete replacement category is invalid."""
