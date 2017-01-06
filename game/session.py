from game.room import RoomStatus
from game.player import PlayerStatus
from game.game_object import GameObject

class Session(GameObject):
    def __init__(self, room):
        """
        Initializes a new session object with the given room
        :param room: Room object the session belongs to
        """
        super().__init__()
        self._room = room
        if self._room.status == RoomStatus.playing:
            raise Exception("Session already in progress")
        self._room.status = RoomStatus.playing
        for player_id in self._room.players:
            self._room.players[player_id].status = PlayerStatus.playing
        self._room.session = self

    def eliminate_player_by_id(self, uuid):
        """
        
        """
        self._room._players[uuid].status = PlayerStatus.eliminated
        self.validate()

    def validate(self):
        num_eliminated = sum(map(lambda x: x.status == PlayerStatus.eliminated, self._room.players.values()))
        if num_eliminated == len(self._room.players):
            self._room.status = RoomStatus.complete
            for player_id in self._room.players:
                self._room.players[player_id].status = PlayerStatus.waiting
