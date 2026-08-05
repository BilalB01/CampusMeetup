from fastapi import WebSocket


# Houdt per activiteit een lijst bij van open WebSocket-verbindingen.
# Bewust een simpele in-memory registry, geen Redis/pub-sub: dit project
# draait single-process (uvicorn --reload, geen meerdere workers), dus elk
# Python-proces heeft toch maar één volledig beeld van wie er verbonden is.
# Bij een herstart (--reload) verliezen alle clients hun verbinding en moet
# de frontend opnieuw connecteren — aanvaardbaar voor dit project.
class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[int, list[WebSocket]] = {}

    async def connect(self, activity_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.setdefault(activity_id, []).append(websocket)

    def disconnect(self, activity_id: int, websocket: WebSocket) -> None:
        connections = self._connections.get(activity_id)
        if not connections:
            return
        if websocket in connections:
            connections.remove(websocket)
        if not connections:
            del self._connections[activity_id]

    # payload moet al JSON-veilig zijn (geen rauwe datetime-objecten) — de
    # aanroepers gebruiken hiervoor MessageOut.model_dump(mode="json")
    async def broadcast(self, activity_id: int, payload: dict) -> None:
        for connection in list(self._connections.get(activity_id, [])):
            try:
                await connection.send_json(payload)
            except Exception:
                # Verbinding is intussen dood (bv. tab hard gesloten) — de
                # eigen websocket-route van die client ruimt zichzelf op
                # via zijn except/finally zodra dat merkbaar wordt
                pass


manager = ConnectionManager()
