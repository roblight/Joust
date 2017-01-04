from flask import Flask, redirect, send_from_directory, request
from flask_socketio import SocketIO, join_room, leave_room, emit
from game.room import Room
from game.player import Player
from game.session import Session
from game.utils import build_game_update_payload
from uuid import UUID
import json

app = Flask(__name__, static_folder="public", static_path="")
socketio = SocketIO(app)
active_rooms = {}
active_players = {}

@app.route("/", methods=["GET"])
def root():
    return send_from_directory("public", "index.html")

@app.route("/new_room", methods=["GET"])
def create_new_room():
    new_room = Room()
    active_rooms[new_room.id] = new_room
    return redirect("/game/{}".format(str(new_room.id), code=302))

@app.route("/join_room/<uuid:room_id>", methods=["GET"])
def join_existing_room(room_id):
    return redirect("/game/{}".format(str(room_id), code=302))

@app.route("/leave_room/<uuid:room_id>/<uuid:player_id>", methods=["GET"])
def leave_room(room_id, player_id):
    room = active_rooms[room_id]
    room.remove_player_by_id(player_id)
    del active_players[player_id]
    socketio.emit("game_update", build_game_update_payload(room), room=str(room_id))
    return json.dumps({"error": None})

@app.route("/game/<uuid:room_id>", methods=["GET"])
def serve_room(room_id):
    if room_id not in active_rooms:
        raise Exception("Room does not exist")
    return send_from_directory("public", "session.html")

@app.route("/begin_session/<uuid:room_id>")
def begin_session_for_room(room_id):
    room = active_rooms[room_id]
    session = Session(room)
    socketio.emit("game_update", build_game_update_payload(room), room=str(room_id))
    return json.dumps({"error": None})

@app.route("/eliminate_player/<uuid:room_id>/<uuid:player_id>")
def eliminate_player(room_id, player_id):
    room = active_rooms[room_id]
    session = room.session
    session.eliminate_player_by_id(player_id)
    socketio.emit("game_update", build_game_update_payload(room), room=str(room_id))
    return json.dumps({"error":None})

@socketio.on("join")
def on_join(data):
    room_id = data["room_id"]
    room = active_rooms[UUID(room_id)]
    new_player = room.add_new_player(UUID(request.sid))
    active_players[UUID(request.sid)] = new_player
    join_room(room_id)
    player_list = list(map(lambda x: str(x), room.players.keys()))
    # emit("player_joined", {"players": player_list}, room=room_id)
    socketio.emit("game_update", build_game_update_payload(room), room=str(room_id))
    emit("join_ack", {"player_id": str(new_player.id)})

@socketio.on("disconnect")
def on_disconnect():
    player_id = UUID(request.sid)
    room_id = active_players[player_id].room.id
    leave_room(room_id, player_id)


if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=4000)
