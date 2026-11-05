/** Les balises de MonClubSportif (MCS) que le robot utilise : adresses des pages et noms des champs des formulaires,
 *  relevés sur le site le 5 novembre 2026 (app.monclubsportif.com, version « classique »). MCS n'a pas d'API publique :
 *  si son site change, on corrige ici seulement. Rien de propre à un club dans ce fichier (les numéros d'équipe sont en
 *  base, table `mcs_teams`), donc il sert tel quel à tout club qui utilise le système. */

export const MCS_SITE_MAP_VERSION = "2026-11-05";
export const MCS_BASE = "https://app.monclubsportif.com";

export const MCS_PATHS = {
  login: "/login",
  account: "/account",
  roster: (team: number, season: number) => `/team/${team}/seasons/${season}/roster`,
  rosterAdd: (team: number, season: number) => `/team/${team}/seasons/${season}/roster/add`,
  member: (team: number, season: number, member: number) => `/team/${team}/seasons/${season}/roster/${member}`,
  memberModify: (team: number, season: number, member: number) => `/team/${team}/seasons/${season}/roster/${member}/modify`,
  /** Par blocs de 5 événements ; sans « page », MCS ouvre le bloc en cours (page 2) : la page 1 = les derniers passés. */
  presences: (team: number, season: number, page: number) => `/team/${team}/seasons/${season}/presences?page=${page}`,
  eventCreate: (team: number, season: number) => `/team/${team}/seasons/${season}/calendar/events/create`,
  eventEdit: (team: number, season: number, id: number) => `/team/${team}/seasons/${season}/calendar/events/${id}/edit`,
  /** Suppression : POST « _method=delete » + jeton de la balise meta csrf-token, en-tête X-Requested-With (sinon refusé). */
  event: (team: number, season: number, id: number) => `/team/${team}/seasons/${season}/calendar/events/${id}`,
  eventCancel: (team: number, season: number, id: number) => `/team/${team}/seasons/${season}/calendar/events/${id}/cancel`,
  settings: (team: number) => `/team/${team}/settings`,
  teamUpdate: (team: number) => `/team/${team}`,
  calendar: (team: number, season: number) => `/team/${team}/seasons/${season}/calendar`,
  /** Assignation en lot : cocher des activités (events[]) puis des membres (assign[]) ; unassign=0 ne retire personne. */
  calendarAssignments: (team: number, season: number) => `/team/${team}/seasons/${season}/calendar/assignments`,
  /** Les activités d'un membre (cases cochées = il y est assigné). */
  memberAssignments: (team: number, season: number, member: number) => `/team/${team}/seasons/${season}/roster/${member}/modify?assignment=true`,
  gameEdit: (team: number, season: number, game: number) => `/team/${team}/seasons/${season}/calendar/games/${game}/edit`,
  game: (team: number, season: number, game: number) => `/team/${team}/seasons/${season}/calendar/games/${game}`
} as const;

/** Noms des champs (Rails) des formulaires de MCS. */
export const MCS_FIELDS = {
  csrf: "authenticity_token",
  method: "_method",
  login: { email: "user_session[email]", password: "user_session[password]", remember: "user_session[remember_me]" },
  member: {
    manager: "member[manager]",
    sendInvitation: "send_invitation",
    firstName: "member[first_name]",
    lastName: "member[last_name]",
    gender: "member[gender]", // male | female
    type: "member[member_type]", // player | coach | reserve | staff
    birthDay: "member[birthday(3i)]",
    birthMonth: "member[birthday(2i)]",
    birthYear: "member[birthday(1i)]",
    picture: "member[picture]",
    email: "email[]",
    relationship: "relationship_type[]", // 1 soi-même, 2 parent/tuteur, 3 autre
    assign: "assign[]",
    privateNote: "member[private_note]"
  },
  team: {
    actionTo: "action_to",
    lockHoursGame: "team[disable_presence_hours_before_game]",
    lockHoursEvent: "team[disable_presence_hours_before_happening]",
    assignAllEvents: "team[assign_all_events]"
  },
  assignments: { events: "events[]", members: "assign[]", unassign: "unassign" },
  game: { opponentId: "game[opponent_id]", opponentName: "opponent[name]", newOpponent: "new", sendByEmail: "send_by_email" }
} as const;

export const MCS_RELATIONSHIP_PARENT = "2";

/** Classes CSS de l'état d'une case de présence (page Présences, vue gestionnaire). */
export const MCS_PRESENCE_STATES = ["unknown", "present", "late", "uncertain", "absent"] as const;
export type McsPresenceState = (typeof MCS_PRESENCE_STATES)[number];
