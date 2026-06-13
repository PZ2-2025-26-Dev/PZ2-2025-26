from sqlalchemy import or_
from sqlalchemy.orm import Session

from src.items.models import Item, LegacyIdentifier
from src.locations.models import Location
from src.locations.schemas import LocationTreeNode


def collect_subtree_location_ids(db: Session, root_id: int) -> list[int]:
    rows = db.query(Location.id, Location.parent_id).filter(Location.is_active.is_(True)).all()
    children_by_parent: dict[int | None, list[int]] = {}
    for loc_id, parent_id in rows:
        children_by_parent.setdefault(parent_id, []).append(loc_id)

    result: list[int] = []
    stack = [root_id]
    while stack:
        current = stack.pop()
        result.append(current)
        stack.extend(children_by_parent.get(current, []))
    return result


def build_tree(locations: list[Location]) -> list[LocationTreeNode]:
    nodes: dict[int, LocationTreeNode] = {
        loc.id: LocationTreeNode(id=loc.id, name=loc.name, type=loc.type) for loc in locations
    }
    roots: list[LocationTreeNode] = []

    for loc in locations:
        node = nodes[loc.id]
        if loc.parent_id and loc.parent_id in nodes:
            nodes[loc.parent_id].children.append(node)
        else:
            roots.append(node)

    return roots


class LocationService:
    def __init__(self, db: Session):
        self.db = db

    def _collect_ancestor_ids(self, location_id: int, lookup: dict[int, Location]) -> set[int]:
        visible: set[int] = set()
        current_id: int | None = location_id
        while current_id is not None and current_id in lookup:
            visible.add(current_id)
            current_id = lookup[current_id].parent_id
        return visible

    def get_location_tree(self, search: str | None = None) -> list[LocationTreeNode]:
        locations = self.db.query(Location).filter(Location.is_active.is_(True)).order_by(Location.name).all()
        if not locations:
            return []

        if not search:
            return build_tree(locations)

        search_pattern = f"%{search}%"
        lookup = {loc.id: loc for loc in locations}
        visible_ids: set[int] = set()

        for loc in locations:
            if search.lower() in loc.name.lower():
                visible_ids.update(self._collect_ancestor_ids(loc.id, lookup))

        matching_item_location_ids = (
            self.db.query(Item.location_id)
            .outerjoin(LegacyIdentifier, LegacyIdentifier.item_id == Item.id)
            .filter(
                or_(
                    Item.name.ilike(search_pattern),
                    LegacyIdentifier.legacy_id.ilike(search_pattern),
                )
            )
            .distinct()
            .all()
        )

        for (location_id,) in matching_item_location_ids:
            if location_id in lookup:
                visible_ids.update(self._collect_ancestor_ids(location_id, lookup))

        if not visible_ids:
            return []

        filtered = [loc for loc in locations if loc.id in visible_ids]
        return build_tree(filtered)
