export const en = {
  // @req REQ-2026-018: mode entrance and projected contest table.
  homeEyebrow: "A SEAT AT THE GREEN ROOM",
  homeTitle: "Choose your table.",
  homeIntro: "Settle in. Play at your own pace.",
  classicTag: "THE ORIGINAL",
  classicMode: "Classic",
  classicIntro:
    "You, the dealer, and a little luck. Play Blackjack with virtual chips.",
  enterClassic: "Enter classic",
  classicSavedHint: "Your saved table is waiting.",
  contestTag: "A DIFFERENT KIND OF 21",
  contestMode: "Contest",
  contestIntro:
    "One shared number deck. Chain trumps, change the target, and duel in a standard best-of-five match.",
  startContest: "Start a match",
  contestMemoryHint:
    "This match stays in memory. Leaving or refreshing abandons it.",
  homeFooter: "Local play. Virtual stakes. Your own pace.",
  home: "Home",
  backHome: "Back to home",
  standardBo5: "Standard · BO5 · Trumps",
  matchScore: "MATCH WINS",
  firstToGames: "First to",
  contestYou: "You",
  contestOpponent: "Opponent",
  contestTable: "Contest table",
  contestGame: "Game",
  contestRound: "Round",
  cardsRemaining: "Cards left",
  contestYourHand: "Your hand",
  cardTotal: "Card total",
  numberCard: "Number card",
  privateCard: "Only you",
  currentActor: "To act",
  cardTarget: "CARD TARGET",
  gamePoints: "GAME POINTS",
  firstToPoints: "Target",
  targetExtended: "Deuce · target extended",
  firstPlayer: "First to act",
  contestReplaying: "Playing the action…",
  contestDealing: "Cards in motion…",
  contestTurnHint:
    "Use trumps below, then Hit or Stay. Two quiet stays reveal both hands.",
  contestPaused: "Match paused",
  opponentThinking: "Opponent is thinking…",
  contestRevealing: "Revealing the round…",
  contestYourTurn: "Your move.",
  roundWon: "You win the round.",
  roundLost: "Opponent wins the round.",
  roundTied: "An even hand.",
  roundPointHint:
    "Round points include active effects. See the point breakdown below.",
  roundTieHint: "A tie adds no points. The next round has a new first player.",
  gameWon: "The game is yours.",
  gameLost: "Opponent takes the game.",
  nextGameHint: "The next game starts at 0 : 0, with a target of 5 points.",
  matchWon: "The match is yours.",
  matchLost: "Opponent takes the match.",
  matchFinishedHint:
    "A full match, well played. Start fresh whenever you like.",
  contestActions: "Contest actions",
  contestStay: "Stay",
  nextContestRound: "Next round",
  nextContestGame: "Next game",
  contestRestart: "New match",
  leaveContestTitle: "Leave this match?",
  leaveContestBody:
    "Returning home abandons this match. Your classic progress stays saved.",
  confirmLeaveContest: "Leave match",
  restartContestTitle: "Start a new match?",
  restartContestBody:
    "This replaces the current match with a new standard BO5.",
  keepPlaying: "Keep playing",
  contestRulesTitle: "Contest rules",
  contestRulesIntro:
    "Standard best of five with trumps. Win three games to take the match.",
  contestRuleDeck:
    "Each round shares one deck containing the numbers 1–11, once each. Both players receive two cards. Your first card is private; your opponent’s first card stays hidden until the reveal.",
  contestRuleTurns:
    "Chain trumps in your turn, then Hit or Stay to pass play. Staying does not lock your hand. Even at or above the current target, you must act. Two consecutive turns ending in Stay without playing a trump or hitting end the round.",
  contestRuleResult:
    "The higher total within the current card target wins. An over-target hand loses to one within the target; if both exceed it, the lower total wins. Equal totals tie. Trumps can change the target from 21.",
  contestRuleScore:
    "A round win normally earns one base point plus up to two bonus points after attack and defense. Ceasefire removes bonuses; Full Guard can prevent all points. Ties add none. First to 5 wins a game; 4 : 4 extends the target to 7, then 6 : 6 to 9. First play alternates each round.",

  // @req REQ-2026-026: playable trump interaction and projected feedback.
  trumpFixtureTitle: "REQ-026 isolated review fixture",
  trumpFixtureWarning:
    "Review only. Fixed cards and a controlled opponent; this page is not part of the normal app or release build.",
  trumpFixtureStep: "Advance fixture opponent",
  trumpFixtureSkip: "Skip committed replay",
  trumpUnknown: "Trump",
  trumpArea: "Trump hand and table effects",
  trumpHand: "Your trumps",
  trumpOpponentCount: "Opponent holds",
  trumpStocks: "Stock left · You {own} · Opponent {opponent}",
  trumpHandHint:
    "Inspect a card, then use it. You can play several trumps before Hit or Stay.",
  trumpAvailable: "Available · inspect",
  trumpReadOnly: "Inspect conditions",
  trumpEmptyHand:
    "No trumps in hand. New rounds and some Hits can provide more.",
  trumpUse: "Use trump",
  trumpUseHint:
    "This card is destroyed when used. Your turn continues after the effects finish.",
  trumpUnavailable:
    "No legal play now. Check this card’s conditions, available table space, targets and cost. Inspecting or cancelling consumes nothing.",
  trumpChoose: "Choose…",
  trumpTarget: "Choose a target",
  trumpOwnTarget: "Choose your effect to exchange",
  trumpEffectChoice: "{owner} · {name} · #{position}",
  trumpNumberChoice: "{owner} · Number {value} · face-up #{position}",
  trumpDeclaration: "Declare a stock card type",
  trumpDeclarationHint:
    "This is the public rulebook, not a view of hidden stock. A miss still consumes the trump.",
  trumpCost: "Pay {count} other trump(s) · {selected} selected",
  trumpCostHint:
    "Selected cards are destroyed as a cost. Their effects do not activate, and Regret does not refund them.",
  trumpTable: "Table effects · You / Opponent",
  trumpTableHint:
    "Up to five effects per side, oldest first. These are effect records; their source cards are already destroyed.",
  trumpEmptyTable: "No table effects.",
  trumpSuppressed: "Suppressed · ownership changes do not release the binding",
  trumpBoundTarget: "Bound to: {target}",
  trumpExpiry: "Expires after {player}’s Turn {turn}",
  trumpWatch: "Watching the first trump played in Turn {turn}",
  trumpRecorded: "Recorded: {name}",
  trumpCharges: "Uses remaining: {count}",
  trumpPeek: "Your current deck peek:",
  trumpPeekHint:
    "Private knowledge. This disappears when the deck order changes.",
  trumpHiddenDouble: "Hidden ×2",
  trumpSymbiosisPending:
    "Symbiosis: hidden contributions combine only at settlement.",
  trumpCurrentTurn: "Turn {turn}",
  trumpFeedback: "Trump activity and round points",
  trumpFeedbackHint: "Trump effects and point sources appear here.",
  trumpActivity: "Recent activity",
  trumpPlayed: "{player} used {name}; the card is destroyed.",
  trumpDrawMiss:
    "{name}: requested number unavailable; the trump was still consumed.",
  trumpDrawn: "{name}: drew number {value}.",
  trumpReturned: "{name}: number {value} returned to the deck bottom.",
  trumpPlaced:
    "{name}: table effect installed. Current target and totals are shown above.",
  trumpCleared:
    "{name}: a table effect was cleared, including any dependent bindings.",
  trumpNumberGenerated: "{name}: generated a new number {value}.",
  trumpNumberDeleted:
    "{name}: number {value} deleted without returning to the deck.",
  trumpSwapped: "{name}: the latest face-up cards were exchanged.",
  trumpModified: "{name}: the public hidden-card multiplier changed.",
  trumpRevealed: "{name}: the hidden card was publicly revealed.",
  trumpPeeked:
    "{name}: private deck knowledge updated. Only the current valid peek is displayed.",
  trumpRotated: "{name}: deck order changed; old position knowledge expired.",
  trumpExchanged:
    "{name}: control of the selected effects exchanged; bindings and expiry stay unchanged.",
  trumpUndone:
    "{name}: the last reversible play was undone. Spent trumps, costs and knowledge are not refunded.",
  trumpSuddenDeath:
    "Sudden Death: the next decisive round wins this game; a tie continues.",
  trumpEffectRemoved: "A table effect ended or was removed.",
  trumpEffectUpdated: "A table effect’s public record was updated.",
  trumpUndoBoundary:
    "A Turn boundary expired an effect or resolved a pending record. The previous trump can no longer be undone, even when that record was unrelated.",
  trumpSupplyBlocked: "{player}: supply blocked by an active effect.",
  trumpSupplyZero:
    "{player}: no trump received (hand full or no eligible stock). Spent cards stay consumed.",
  trumpOpponentSupply:
    "{player}: supply processed; unpublished identities remain hidden.",
  trumpReceived: "{player} drew {name} from stock.",
  trumpGenerated:
    "{player} generated {name}; this does not consume a stock copy.",
  trumpTransferred: "{player} received the transferred {name}.",
  trumpStockDeleted: "A stock copy of {name} was deleted.",
  trumpStockMiss:
    "No stock copy of {name} was deleted; the played trump was still consumed.",
  trumpCostPaid: "{player} paid {name} as a cost; its effect did not activate.",
  trumpRoundCleanup:
    "Round effects cleared. Unplayed trumps and remaining stock carry into the next round.",
  trumpGameCleanup:
    "Game resources cleared. The next game starts with fresh stocks.",
  trumpTargetExtended: "Game point target extended to {target}.",
  trumpScoreAward: "{player} · round points +{points}",
  trumpScoreBase: "Base",
  trumpScoreAttack: "Attack",
  trumpScoreDefense: "Defense",
  trumpScoreBonus: "Final bonus",
  trumpScoreGuarded:
    "Full Guard prevented all points, including the base point. This round is still complete.",
  trumpScoreCeasefire: "Ceasefire removed all bonus points.",
  contestRuleResources:
    "Each game starts with two trumps plus one for each new round. Ordinary Hits have a 30% supply gate. Your hand holds eight; each side can keep five table effects. Stock draws are without replacement.",
  contestRuleEffects:
    "A played trump and its costs are destroyed, even if the effect misses. Use several trumps in one turn; Hit or Stay ends it. Clearing an effect does not recover its card. Regret only reverses the last eligible play, never costs, randomness or known information.",
  contestRuleBaseline:
    "The current opponent draws trumps but only chooses Hit or Stay. Trump-combination AI and active skills arrive in later development.",

  // @req REQ-2026-013: catalog copy; no codex page is mounted yet.
  "contest.trump.draw-2.name": "Draw 2",
  "contest.trump.draw-2.description":
    "Draw the number 2. If it is unavailable, this trump is still consumed without effect.",
  "contest.trump.draw-3.name": "Draw 3",
  "contest.trump.draw-3.description":
    "Draw the number 3. If it is unavailable, this trump is still consumed without effect.",
  "contest.trump.draw-4.name": "Draw 4",
  "contest.trump.draw-4.description":
    "Draw the number 4. If it is unavailable, this trump is still consumed without effect.",
  "contest.trump.draw-5.name": "Draw 5",
  "contest.trump.draw-5.description":
    "Draw the number 5. If it is unavailable, this trump is still consumed without effect.",
  "contest.trump.draw-6.name": "Draw 6",
  "contest.trump.draw-6.description":
    "Draw the number 6. If it is unavailable, this trump is still consumed without effect.",
  "contest.trump.draw-7.name": "Draw 7",
  "contest.trump.draw-7.description":
    "Draw the number 7. If it is unavailable, this trump is still consumed without effect.",
  "contest.trump.return.name": "Return",
  "contest.trump.return.description":
    "Return your last face-up number card to the pool. Requires a face-up card.",
  "contest.trump.remove.name": "Remove",
  "contest.trump.remove.description":
    "Return your opponent’s last face-up number card to the pool. Requires a face-up card and may rescue a bust.",
  "contest.trump.exchange.name": "Exchange",
  "contest.trump.exchange.description":
    "Swap both players’ last face-up number cards. Both must have a face-up card; this does not trigger draw rewards.",
  "contest.trump.destroy.name": "Dispel",
  "contest.trump.destroy.description":
    "Remove your opponent’s most recently placed trump still on the table. Requires an opposing table trump; completed effects are not undone.",
  "contest.trump.destroy-all.name": "Sweep",
  "contest.trump.destroy-all.description":
    "Remove all opposing table trumps. Requires at least one; completed effects are not undone.",
  "contest.trump.best-draw.name": "Best Draw",
  "contest.trump.best-draw.description":
    "Draw the highest remaining number that keeps your total within the target, or the lowest if all would exceed it. Consumed even if the pool is empty.",
  "contest.trump.pressure.name": "Pressure",
  "contest.trump.pressure.description":
    "While in play, gain 1 bonus point if you win this round, subject to defenses and the bonus cap. Does not benefit your opponent if you lose.",
  "contest.trump.pressure-supply.name": "Prepared Pressure",
  "contest.trump.pressure-supply.description":
    "Gain up to 1 trump. While in play, gain 1 bonus point if you win, subject to defenses and the cap. Requires table space; supply and hand capacity limit the draw.",
  "contest.trump.shield.name": "Cushion",
  "contest.trump.shield.description":
    "While in play, cancel 1 opposing bonus point if you lose this round. Does not reduce the base point.",
  "contest.trump.shared-supply.name": "Shared Supply",
  "contest.trump.shared-supply.description":
    "You gain up to 1 trump, then your opponent gains up to 1. Each uses their own supply and hand capacity.",
  "contest.trump.resource-swap.name": "Refit",
  "contest.trump.resource-swap.description":
    "Choose and discard another trump from your hand, then gain up to 2. Pay the cost first; limited supply or capacity does not refund it.",
  "contest.trump.harvest.name": "Reserve",
  "contest.trump.harvest.description":
    "While in play, gain up to 1 trump after consuming another trump, at most twice, then remove this effect. Does not trigger itself or trigger from grants; supply and capacity apply.",
  "contest.trump.target-17.name": "Target 17",
  "contest.trump.target-17.description":
    "While in play, set both players’ target to 17, replacing any existing target trump. Removing it restores 21. Requires table space.",
  "contest.trump.target-24.name": "Target 24",
  "contest.trump.target-24.description":
    "While in play, set both players’ target to 24, replacing any existing target trump. Removing it restores 21. Requires table space.",
  "contest.trump.target-27.name": "Target 27",
  "contest.trump.target-27.description":
    "While in play, set both players’ target to 27, replacing any existing target trump. Removing it restores 21. Requires table space.",
  // @req REQ-2026-025: 54 registered definitions; Skill Revival remains pending.
  "contest.trump.symbiosis.name": "Symbiosis",
  "contest.trump.symbiosis.description":
    "At settlement, both hidden contributions become their combined effective value. Replaces existing Symbiosis; removable.",
  "contest.trump.double-hidden.name": "Double Hidden",
  "contest.trump.double-hidden.description":
    "Set the opponent’s hidden multiplier to 2 this round; repeated uses do not multiply it further.",
  "contest.trump.bandwagon.name": "Follow Suit",
  "contest.trump.bandwagon.description":
    "Watch the opponent’s first trump next turn. At your next turn retrieve a matching card from your stock, then expire. No copy is generated; capacity applies.",
  "contest.trump.normalize.name": "Normalize",
  "contest.trump.normalize.description":
    "Restore your hidden multiplier from 2 to 1. Requires a multiplier of 2.",
  "contest.trump.hush.name": "Quiet Window",
  "contest.trump.hush.description":
    "Block the opponent’s normal Hit next turn, then expire. Trumps and Stay remain available; does not stack for the same side.",
  "contest.trump.embargo.name": "Embargo",
  "contest.trump.embargo.description":
    "Block the first otherwise eligible trump grant during the opponent’s next turn, then expire. Also expires at that turn’s end.",
  "contest.trump.full-shield.name": "Full Guard",
  "contest.trump.full-shield.description":
    "If you lose this round, the opponent scores zero including the base point. Does not prevent Sudden Death from deciding the game; does not stack.",
  "contest.trump.last-stand.name": "Last Stand",
  "contest.trump.last-stand.description":
    "Gain 2 attack bonus points if both hands bust and you win. Defense and the bonus cap still apply.",
  "contest.trump.ceasefire.name": "Ceasefire",
  "contest.trump.ceasefire.description":
    "Set both sides’ bonus points to zero this round. The base point and Full Guard still apply; replaces existing Ceasefire.",
  "contest.trump.risk-pledge.name": "Risk Pledge",
  "contest.trump.risk-pledge.description":
    "Gain 2 attack bonus points if you win; give the opponent 1 if you lose. Defense and the cap apply.",
  "contest.trump.forced-draw.name": "Forced Draw",
  "contest.trump.forced-draw.description":
    "The opponent draws the top number face up. Requires a nonempty deck; keeps your turn and grants no Hit reward.",
  "contest.trump.redraw.name": "Redraw",
  "contest.trump.redraw.description":
    "Return your last face-up card to the deck’s end, then draw its top card. Requires a face-up card; grants no Hit reward.",
  "contest.trump.scry.name": "Scry",
  "contest.trump.scry.description":
    "Privately inspect up to two top numbers in order. Deck changes invalidate their positions; consumed even with an empty deck.",
  "contest.trump.deck-rotate.name": "Bottom Turn",
  "contest.trump.deck-rotate.description":
    "Move the top number to the deck’s end without revealing it. Requires at least two remaining cards.",
  "contest.trump.trim.name": "Lighten",
  "contest.trump.trim.description":
    "Return your face-up cards with original values of 8 or more to the deck’s end, left to right. Requires a matching card; protects the logical hidden slot.",
  "contest.trump.reveal-self.name": "Open Hand",
  "contest.trump.reveal-self.description":
    "Reveal your hidden card and gain up to one trump. Requires an unrevealed card; preserves its logical hidden slot.",
  "contest.trump.reveal-opponent.name": "Expose",
  "contest.trump.reveal-opponent.description":
    "Reveal the opponent’s hidden card to both players. Requires an unrevealed card; preserves its logical hidden slot.",
  "contest.trump.target-lock.name": "Target Anchor",
  "contest.trump.target-lock.description":
    "Until the opponent’s next turn ends, block new target effects. Existing targets may still be removed to restore the base target.",
  "contest.trump.table-exchange.name": "Table Exchange",
  "contest.trump.table-exchange.description":
    "Exchange one eligible effect from each side, preserving charges without replaying immediate effects. Suppression keeps its target and original expiry.",
  "contest.trump.suppress.name": "Suppress",
  "contest.trump.suppress.description":
    "Suspend one opposing effect until the opponent’s next turn ends. Cannot target Suppress; leaves if its target leaves. Immediate effects remain.",
  "contest.trump.decommission.name": "Decommission",
  "contest.trump.decommission.description":
    "Remove one of your table effects, then gain up to one trump. The destroyed source card is not recovered.",
  "contest.trump.banish-copy.name": "Cut Supply",
  "contest.trump.banish-copy.description":
    "Declare a public definition and destroy one matching card in opposing remaining stock. Consumed on a miss; held cards are untouched.",
  "contest.trump.heavy-hit.name": "Heavy Hit",
  "contest.trump.heavy-hit.description":
    "If the opponent Hits next turn, draw up to two numbers in one turn with one grant gate. Expires after that turn.",
  "contest.trump.face-lighten.name": "Soft Step",
  "contest.trump.face-lighten.description":
    "Bind your chosen face-up card: contribution minus 2, minimum 1. Does not stack on the same card; leaves when it returns to the deck.",
  "contest.trump.face-burden.name": "Extra Weight",
  "contest.trump.face-burden.description":
    "Bind an opposing face-up card: contribution plus 2. Does not change its printed value or stack on the same card.",
  "contest.trump.resonance.name": "Resonance",
  "contest.trump.resonance.description":
    "Set the target to 21 plus both sides’ current non-hidden face-up card count. Replaces other targets and does not track later changes.",
  "contest.trump.supply-cache.name": "Supply Cache",
  "contest.trump.supply-cache.description":
    "Your next successful normal Hit grant draws up to two trumps, then expires. A failed gate does not consume the charge; round end clears it.",
  "contest.trump.life-trade.name": "Risk for Supply",
  "contest.trump.life-trade.description":
    "Draw one top number, then gain up to two trumps. Requires a nonempty number deck; keeps your turn and grants no extra Hit reward.",
  "contest.trump.purge-hand.name": "Clean Slate",
  "contest.trump.purge-hand.description":
    "Destroy all your other held trumps as a private cost, then gain up to three. Requires another held card; costs are never refunded.",
  "contest.trump.safe-hit.name": "Safe Hit",
  "contest.trump.safe-hit.description":
    "On your next normal Hit, return its first drawn card face up to the deck’s end if it would bust. Still ends the turn and checks one grant gate; one charge.",
  "contest.trump.regret.name": "Regret",
  "contest.trump.regret.description":
    "Undo the last eligible play’s actual effects. Destroyed cards, costs, randomness, turns and known information stay committed; undoing deletion creates a new identity.",
  "contest.trump.skill-revival.name": "Skill Revival",
  "contest.trump.skill-revival.description":
    "Registered for the active-skill stage; not admitted yet. Will restore one successfully used skill charge up to its initial cap and allow an extra activation this game.",
  "contest.trump.sudden-death.name": "Sudden Death",
  "contest.trump.sudden-death.description":
    "The next decisive round wins this game directly, including through Full Guard. Ties carry the marker forward; does not win the match directly or allow a second marker.",
  "contest.codex.title": "Codex",
  "contest.codex.locked": "???",
  "contest.codex.new": "New",
  "contest.codex.viewed": "Viewed",
  "contest.codex.experimental": "Experimental candidate; not admitted",

  split: "Split",
  surrender: "Surrender",
  surrenderSub: "Half of your main wager is returned.",
  surrenderShort: "Surrender",
  mixed: "Each hand has its story.",
  mixedSub: "See each hand below; the net includes insurance.",
  mixedShort: "Mixed results",
  insurance: "Insurance",
  insurancePhase: "Insurance decision",
  insure: "Buy insurance",
  declineInsurance: "No insurance",
  insuranceHint:
    "Costs half the original wager. Pays 2:1 net if the dealer has Blackjack.",
  insuranceUnaffordable:
    "Not enough chips for insurance. Choose no insurance to continue.",
  insuranceWin: "Insurance won",
  insuranceLose: "Insurance lost",
  insuranceDeclined: "Insurance declined",
  activeHand: "Playing",
  handStood: "Stood",
  handBusted: "Busted",
  handWaiting: "Waiting",
  helpSplit:
    "Equal-value first two cards; one additional wager, two hands maximum.",
  helpSurrender:
    "Before your first action, after dealer Blackjack is ruled out. Half the main wager is returned.",
  legacySave:
    "This browser save uses an unsupported version. It has not been overwritten. Import a v2 backup or explicitly start a new game; v1 cannot be migrated.",

  room: "THE GREEN ROOM",
  subtitle: "A little luck. A little instinct.",
  live: "YOUR PRIVATE TABLE",
  wallet: "YOUR BANKROLL",
  round: "ROUND",
  rules: "Table rules",
  saves: "Save & restore",
  settings: "Settings",
  about: "About",
  backToSettings: "Back to settings",
  appVersion: "Version",
  repository: "Project repository",
  license: "Open-source license",
  mitLicense: "MIT License",
  feedback: "Feedback",
  feedbackHint:
    "Questions, bugs, or ideas? Share them with us on GitHub Issues.",
  openIssues: "Visit GitHub Issues",
  history: "Recent hands",
  dealer: "THE DEALER",
  player: "YOUR HAND",
  waiting: "Waiting for your wager",
  turn: "The next move is yours",
  dealing: "Let the cards unfold",
  dealerTurn: "The dealer is playing",
  settled: "A hand well played",
  betLabel: "ON THE TABLE",
  placeBet: "Make your opening move.",
  betHint: "Choose your chips, then deal yourself in.",
  hit: "Hit",
  stand: "Stand",
  double: "Double",
  deal: "Deal cards",
  next: "Next hand",
  undo: "Undo",
  clear: "Clear",
  allIn: "All in",
  chip: "Bet",
  blackjack: "Blackjack.",
  win: "The hand is yours.",
  lose: "The house takes it.",
  push: "An even hand.",
  blackjackSub: "A perfect start. Paid 3 to 2.",
  winSub: "Trust your instinct. Enjoy the win.",
  loseSub: "A new hand is a new possibility.",
  pushSub: "Your main wager returns to you. Insurance is settled separately.",
  payout: "NET RESULT",
  bet: "Wager",
  balance: "Bankroll",
  soft: "soft",
  hidden: "Hidden card",
  empty: "Your next story starts here.",
  footer: "BLACKJACK PAYS 3:2",
  footer2: "DEALER STANDS ON ALL 17s",
  practice: "Play money. Pure play.",
  close: "Close",
  language: "Language",
  sound: "Table sounds",
  volume: "Volume",
  motion: "Animation",
  system: "Follow device",
  reduce: "Reduced",
  full: "Full",
  on: "On",
  off: "Off",
  export: "Export save",
  import: "Choose save file",
  saveCopy:
    "Your progress saves automatically on this browser. Export a copy to keep it safe or take it to another device.",
  saved: "AUTO-SAVED LOCALLY",
  storage:
    "Browser saving is unavailable. Export a file to keep your progress.",
  corrupt:
    "This browser save could not be read. Import a backup or start a new game.",
  conflict:
    "This game was changed in another tab. Load the latest progress to continue.",
  reload: "Load latest",
  newGame: "New game",
  resetTitle: "Start a fresh table?",
  resetCopy:
    "This replaces your current game with 2,000 chips. Export your progress first if you want to keep it.",
  confirmReset: "Start fresh",
  cancel: "Cancel",
  importTitle: "Restore this game?",
  importCopy:
    "This replaces your current game and preferences. Export a backup first if needed.",
  confirmImport: "Restore game",
  invalid:
    "This file is not a valid Blackjack save. Your game has not changed.",
  version: "This save version is not supported. Your game has not changed.",
  size: "This file is too large (maximum 128 KB).",
  noHistory: "Your first hand is still ahead of you.",
  exhausted: "Time for a fresh start.",
  exhaustedCopy:
    "You need at least one chip to place a wager. Start fresh or restore a saved game.",
  rulesTitle: "A seat at the table",
  rulesIntro: "One player. One dealer. Get closer to 21 without going over.",
  rulesList: [
    "A fresh 52-card deck is shuffled each hand. Face cards are worth 10. Aces count as 1 or 11.",
    "The dealer has one hidden card. With an Ace showing, choose insurance before Blackjack is checked. Two natural Blackjacks tie.",
    "An unsplit two-card Blackjack pays 3:2. Other wins pay 1:1. A tie returns your main wager.",
    "Hit to draw, or stand to finish. A regular 21 ends your turn, but does not guarantee a win.",
    "The dealer draws below 17 and stands on every 17, including soft 17.",
    "Double on your first two cards if your bankroll covers it: double the wager, draw one card, then stand.",
    "Main wagers use whole chips; insurance and returns can include half chips. All in wagers your whole-chip balance.",
    "Split equal-value first cards into two hands with an extra wager. No re-splitting. Split 21 is not Blackjack. Split aces get one card each and cannot double; other split hands can double.",
    "Insurance costs half the original wager and pays 2:1 net for dealer Blackjack. It is settled separately, even when you have Blackjack.",
    "Late surrender returns half your main wager before you hit, double or split, after dealer Blackjack is ruled out. Insurance losses are not refunded.",
  ],
  result: "Result",
  winShort: "Win",
  loseShort: "Loss",
  pushShort: "Push",
  blackjackShort: "Blackjack",
  fileDate: "Saved",
  phase: "Stage",
  bettingPhase: "Betting",
  playerPhase: "Your turn",
  settledPhase: "Settled",
  dealerPhase: "Dealer turn",
  roundNote: "SINGLE DECK · CLASSIC RULES",
  busy: "Cards in motion",
  muted: "Toggle sound",
  helpDouble: "First two cards only; requires an additional wager.",
  cardName: "Card",
  showHistory: "View recent hands",
  importReadError: "This file could not be read. Please try another copy.",
};
export type Copy = typeof en;
export const zh: Copy = {
  // @req REQ-2026-018: mode entrance and projected contest table.
  homeEyebrow: "绿房间，为你留座",
  homeTitle: "选一张牌桌，入座。",
  homeIntro: "放慢节奏，享受这一手。",
  classicTag: "经典玩法",
  classicMode: "经典模式",
  classicIntro: "你与庄家的二十一点。用虚拟筹码，试试策略与运气。",
  enterClassic: "进入经典",
  classicSavedHint: "上次的牌桌进度，已为你保留。",
  contestTag: "另一种二十一点",
  contestMode: "竞赛模式",
  contestIntro:
    "共享数字牌堆，连续使用道具、改变目标点数，开始一场标准五局三胜对决。",
  startContest: "开始比赛",
  contestMemoryHint: "比赛仅保留在内存中，离开或刷新即放弃。",
  homeFooter: "本地单机 · 虚拟筹码 · 随心游玩",
  home: "首页",
  backHome: "返回首页",
  standardBo5: "标准 · 五局三胜 · 含道具",
  matchScore: "胜局比分",
  firstToGames: "胜场所需局数",
  contestYou: "你",
  contestOpponent: "对手",
  contestTable: "竞赛牌桌",
  contestGame: "局",
  contestRound: "回合",
  cardsRemaining: "剩余牌数",
  contestYourHand: "你的手牌",
  cardTotal: "牌面点数",
  numberCard: "数字牌",
  privateCard: "仅你可见",
  currentActor: "当前行动方",
  cardTarget: "牌面目标",
  gamePoints: "局内积分",
  firstToPoints: "胜局目标分",
  targetExtended: "平分递延 · 目标提高",
  firstPlayer: "本回合先手",
  contestReplaying: "正在回放行动…",
  contestDealing: "正在发牌…",
  contestTurnHint: "可在下方连续用卡，再要牌或停牌。双方连续安静停牌后揭牌。",
  contestPaused: "比赛已暂停",
  opponentThinking: "对手正在思考…",
  contestRevealing: "正在揭牌结算…",
  contestYourTurn: "轮到你了。",
  roundWon: "你赢下了这一回合。",
  roundLost: "对手赢下了这一回合。",
  roundTied: "这一手，平分秋色。",
  roundPointHint: "本回合积分包含生效道具修正，明细见下方。",
  roundTieHint: "平局不计分，下一回合轮换先手。",
  gameWon: "这一局，属于你。",
  gameLost: "对手赢下了这一局。",
  nextGameHint: "下一局积分从 0 : 0 开始，胜局目标分重置为 5。",
  matchWon: "这场比赛，属于你。",
  matchLost: "对手赢下了这场比赛。",
  matchFinishedHint: "一场完整的较量。准备好后，随时再开一场。",
  contestActions: "竞赛操作",
  contestStay: "停牌",
  nextContestRound: "下一回合",
  nextContestGame: "下一局",
  contestRestart: "新比赛",
  leaveContestTitle: "离开这场比赛？",
  leaveContestBody: "返回首页将放弃当前比赛。经典模式进度仍会保存。",
  confirmLeaveContest: "放弃并返回",
  restartContestTitle: "开始一场新比赛？",
  restartContestBody: "当前比赛将被替换为新的标准五局三胜比赛。",
  keepPlaying: "继续比赛",
  contestRulesTitle: "竞赛规则",
  contestRulesIntro: "含道具的标准五局三胜，先赢下三局，即获整场胜利。",
  contestRuleDeck:
    "每回合共享 1–11 各一张的数字牌。双方各发两张，首张为暗牌：自己的暗牌自己可见，对手暗牌到结算揭牌才公开。",
  contestRuleTurns:
    "本次行动可连续使用道具，再要牌或停牌交权。停牌不锁死手牌，轮回自己时可重新决策；达到或超过当前目标仍需行动。双方连续完成未用卡、未要牌的安静停牌后揭牌结算。",
  contestRuleResult:
    "在当前牌面目标内点数较大者胜；超出目标者输给未超出者，双方都超出时点数较小者胜，相同则平局。道具可以改变默认21点目标。",
  contestRuleScore:
    "回合胜方通常取得基础1分，加上进攻减防御后最多2分额外分。息战清额外分，护身可令本回合得0分；平局0分。先达5分胜局，4:4递延到7分、6:6递延到9分。每回合轮换先手。",

  // @req REQ-2026-026: playable trump interaction and projected feedback.
  trumpFixtureTitle: "REQ-026 隔离审查夹具",
  trumpFixtureWarning:
    "仅供审查：固定牌与受控对手。本页不属于正常入口或发布构建。",
  trumpFixtureStep: "推进夹具对手",
  trumpFixtureSkip: "跳过已提交回放",
  trumpUnknown: "道具",
  trumpArea: "道具手牌与留场效果",
  trumpHand: "你的道具",
  trumpOpponentCount: "对手持有",
  trumpStocks: "剩余库存 · 你 {own} · 对手 {opponent}",
  trumpHandHint: "点选道具查看详情并使用。要牌或停牌前，可连续使用多张道具。",
  trumpAvailable: "可用 · 查看",
  trumpReadOnly: "查看使用条件",
  trumpEmptyHand: "当前没有道具。新回合与部分普通要牌可获得补给。",
  trumpUse: "使用道具",
  trumpUseHint: "使用后本牌立即销毁。效果回放完毕后仍由你行动。",
  trumpUnavailable:
    "当前没有合法用法。请核对本牌条件、留场容量、目标与费用；查看或取消均不消耗道具。",
  trumpChoose: "请选择…",
  trumpTarget: "选择目标",
  trumpOwnTarget: "选择要交换的己方效果",
  trumpEffectChoice: "{owner} · {name} · 第{position}项",
  trumpNumberChoice: "{owner} · 数字{value} · 第{position}张明牌",
  trumpDeclaration: "声明要删除的库存类型",
  trumpDeclarationHint:
    "此列表来自公开规则目录，不代表隐藏库存。未命中仍会消耗道具。",
  trumpCost: "支付另外{count}张道具 · 已选{selected}张",
  trumpCostHint: "所选道具作为费用销毁，不发动其效果；悔牌也不会返还费用。",
  trumpTable: "留场效果 · 你／对手",
  trumpTableHint:
    "双方各最多五项，按从旧到新排列。这些是效果记录，来源道具牌已经销毁。",
  trumpEmptyTable: "当前没有留场效果。",
  trumpSuppressed: "受压制 · 转移控制权不会解除绑定",
  trumpBoundTarget: "绑定目标：{target}",
  trumpExpiry: "在{player}的第{turn}行动轮结束后到期",
  trumpWatch: "记录第{turn}行动轮的首张已用道具",
  trumpRecorded: "已记录：{name}",
  trumpCharges: "剩余触发次数：{count}",
  trumpPeek: "你当前窥见的堆顶：",
  trumpPeekHint: "仅你可见。牌堆顺序变化后，此片段失效。",
  trumpHiddenDouble: "暗牌×2",
  trumpSymbiosisPending: "共生：在揭牌结算时合并双方暗牌贡献。",
  trumpCurrentTurn: "行动轮 {turn}",
  trumpFeedback: "道具反馈与回合积分",
  trumpFeedbackHint: "道具效果与积分来源将在此显示。",
  trumpActivity: "近期行动记录",
  trumpPlayed: "{player}使用{name}，本牌已销毁。",
  trumpDrawMiss: "{name}：指定数字不可得，道具仍已消耗。",
  trumpDrawn: "{name}：抽到数字{value}。",
  trumpReturned: "{name}：数字{value}已返回牌堆末尾。",
  trumpPlaced: "{name}：效果已留场；当前目标与有效点数见牌桌。",
  trumpCleared: "{name}：已清除留场效果及其依赖绑定。",
  trumpNumberGenerated: "{name}：生成新的数字{value}。",
  trumpNumberDeleted: "{name}：数字{value}已删除，不返回牌堆。",
  trumpSwapped: "{name}：双方末张明牌已交换。",
  trumpModified: "{name}：公开暗牌倍率已更新。",
  trumpRevealed: "{name}：暗牌已向双方公开。",
  trumpPeeked: "{name}：私有堆顶信息已更新，仅显示当前仍有效的窥序片段。",
  trumpRotated: "{name}：牌堆顺序已改变，旧位置情报失效。",
  trumpExchanged: "{name}：所选效果控制权已交换，绑定与原到期行动轮保持不变。",
  trumpUndone:
    "{name}：已撤销上一手的可逆效果；已消耗道具、费用与既知信息不回退。",
  trumpSuddenDeath: "赌命：下一次决胜回合决定本局胜方，平局继续。",
  trumpEffectRemoved: "一项留场效果已结束或移除。",
  trumpEffectUpdated: "留场效果的公开记录已更新。",
  trumpUndoBoundary:
    "行动轮边界使效果到期或处理了待办，上一手道具的悔牌窗口已关闭，即使该记录与上一手无关。",
  trumpSupplyBlocked: "{player}：本次补给被生效中的封锁阻止。",
  trumpSupplyZero:
    "{player}：本次领取为零（手满或无可领取库存），已消耗道具不退还。",
  trumpOpponentSupply: "{player}：补给已处理，未公开身份保持隐藏。",
  trumpReceived: "{player}从库存抽取{name}。",
  trumpGenerated: "{player}生成{name}，不扣除库存副本。",
  trumpTransferred: "{player}取得转移的{name}。",
  trumpStockDeleted: "已删除一张{name}库存副本。",
  trumpStockMiss: "未删除{name}库存副本，已打出的道具仍消耗。",
  trumpCostPaid: "{player}支付{name}作为费用，未发动其效果。",
  trumpRoundCleanup: "回合效果已清理，未使用道具与剩余库存保留到下一回合。",
  trumpGameCleanup: "本局资源已清空，下一局重新建立库存。",
  trumpTargetExtended: "胜局目标分已递延至{target}。",
  trumpScoreAward: "{player} · 本回合积分 +{points}",
  trumpScoreBase: "基础分",
  trumpScoreAttack: "进攻",
  trumpScoreDefense: "防御",
  trumpScoreBonus: "封顶额外分",
  trumpScoreGuarded: "护身抵消了包括基础分在内的全部积分，本回合仍已完整结算。",
  trumpScoreCeasefire: "息战清除了全部额外分。",
  contestRuleResources:
    "每局开始取得两张道具，每个新回合再补一张。普通要牌有30%补给门控，手持上限八张、双方各最多五项留场；库存抽取不放回。",
  contestRuleEffects:
    "合法出卡及费用立即销毁，效果未命中也消耗。同一行动轮可连续用卡，要牌或停牌才交权。清除效果不回收卡体；悔牌仅撤销上一手可逆效果，不返还费用、不倒退随机与已知信息。",
  contestRuleBaseline:
    "当前对手会领取道具，但只选择要牌或停牌；道具组合AI与主动技将在后续开发中接入。",

  // @req REQ-2026-013: catalog copy; no codex page is mounted yet.
  "contest.trump.draw-2.name": "指定抽牌·2",
  "contest.trump.draw-2.description":
    "抽取数字2。若已不在牌堆中，道具仍会消耗且不产生效果。",
  "contest.trump.draw-3.name": "指定抽牌·3",
  "contest.trump.draw-3.description":
    "抽取数字3。若已不在牌堆中，道具仍会消耗且不产生效果。",
  "contest.trump.draw-4.name": "指定抽牌·4",
  "contest.trump.draw-4.description":
    "抽取数字4。若已不在牌堆中，道具仍会消耗且不产生效果。",
  "contest.trump.draw-5.name": "指定抽牌·5",
  "contest.trump.draw-5.description":
    "抽取数字5。若已不在牌堆中，道具仍会消耗且不产生效果。",
  "contest.trump.draw-6.name": "指定抽牌·6",
  "contest.trump.draw-6.description":
    "抽取数字6。若已不在牌堆中，道具仍会消耗且不产生效果。",
  "contest.trump.draw-7.name": "指定抽牌·7",
  "contest.trump.draw-7.description":
    "抽取数字7。若已不在牌堆中，道具仍会消耗且不产生效果。",
  "contest.trump.return.name": "收回",
  "contest.trump.return.description":
    "将自己最后一张明牌放回数字牌堆。需要自己有明牌。",
  "contest.trump.remove.name": "驱离",
  "contest.trump.remove.description":
    "将对手最后一张明牌放回数字牌堆。需要对手有明牌，也可能帮助对手解除爆牌。",
  "contest.trump.exchange.name": "易位",
  "contest.trump.exchange.description":
    "交换双方最后一张明牌。双方都必须有明牌；不触发抽牌奖励。",
  "contest.trump.destroy.name": "拆解",
  "contest.trump.destroy.description":
    "清除对手最近放置且仍在场的一张道具。需要对手有留场道具；不撤销已执行的效果。",
  "contest.trump.destroy-all.name": "清场",
  "contest.trump.destroy-all.description":
    "清除对手全部留场道具。需要对手有留场道具；不撤销已执行的效果。",
  "contest.trump.best-draw.name": "精准抽牌",
  "contest.trump.best-draw.description":
    "抽取不会令自己超过当前目标的最大剩余数字；若全部会超出则抽最小数字。空堆时仍消耗道具。",
  "contest.trump.pressure.name": "施压",
  "contest.trump.pressure.description":
    "留场期间，本回合获胜时额外获得1分；受防御与额外加分上限影响。失败时不替对手加分。",
  "contest.trump.pressure-supply.name": "战备施压",
  "contest.trump.pressure-supply.description":
    "补充最多1张道具。留场期间，本回合获胜额外获得1分，受防御与上限影响。桌面满时不能使用；补牌受库存和手牌容量限制。",
  "contest.trump.shield.name": "缓冲",
  "contest.trump.shield.description":
    "留场期间，自己输掉本回合时抵消对手1点额外加分，不抵消基础分。",
  "contest.trump.shared-supply.name": "共同补给",
  "contest.trump.shared-supply.description":
    "自己先补充最多1张道具，再由对手补充最多1张。各自使用自己的库存，受手牌容量限制。",
  "contest.trump.resource-swap.name": "整备",
  "contest.trump.resource-swap.description":
    "选择并弃掉另一张道具手牌，再补充最多2张。必须先支付弃牌费用；领取不足时不返还。",
  "contest.trump.harvest.name": "余粮",
  "contest.trump.harvest.description":
    "留场后，每消耗一张其他道具补充最多1张，最多触发2次后离场。自身不触发，补牌不递归触发；受库存与容量限制。",
  "contest.trump.target-17.name": "目标17",
  "contest.trump.target-17.description":
    "留场期间，双方目标点数改为17，替换已有目标牌。清除后恢复21；桌面满时不能使用。",
  "contest.trump.target-24.name": "目标24",
  "contest.trump.target-24.description":
    "留场期间，双方目标点数改为24，替换已有目标牌。清除后恢复21；桌面满时不能使用。",
  "contest.trump.target-27.name": "目标27",
  "contest.trump.target-27.description":
    "留场期间，双方目标点数改为27，替换已有目标牌。清除后恢复21；桌面满时不能使用。",
  // @req REQ-2026-025: 54 registered definitions; Skill Revival remains pending.
  "contest.trump.symbiosis.name": "共生",
  "contest.trump.symbiosis.description":
    "结算时，双方暗牌贡献均变为两方有效暗牌贡献之和；替换已有共生，可被清除。",
  "contest.trump.double-hidden.name": "双效暗牌",
  "contest.trump.double-hidden.description":
    "本回合对方暗牌倍率设为2，重复使用不继续叠乘；归一可反制。",
  "contest.trump.bandwagon.name": "从众",
  "contest.trump.bandwagon.description":
    "记录对方下个行动轮消费的首张道具；自己下轮开始时从库存检索同定义一张后离场，缺牌或手满失败，不生成副本。",
  "contest.trump.normalize.name": "归一",
  "contest.trump.normalize.description":
    "自己的暗牌倍率从2恢复1；仅倍率为2时可用。",
  "contest.trump.hush.name": "静默",
  "contest.trump.hush.description":
    "封锁对方下轮普通要牌，轮末离场；道具和停牌仍可用，同方同类不叠加。",
  "contest.trump.embargo.name": "断供",
  "contest.trump.embargo.description":
    "阻止对方下轮第一次本可领取的道具，最多一张后离场；未触发也在该轮结束时离场。",
  "contest.trump.full-shield.name": "护身",
  "contest.trump.full-shield.description":
    "本回合自己输时令对方所得归零，含基础分；不能阻止赌命判局胜，同方不叠加。",
  "contest.trump.last-stand.name": "背水",
  "contest.trump.last-stand.description":
    "双方均爆牌且自己赢时进攻加分增加2；仍受防御抵消与上限约束。",
  "contest.trump.ceasefire.name": "息战",
  "contest.trump.ceasefire.description":
    "本回合双方额外分归零，保留基础分与护身归零；替换已有息战。",
  "contest.trump.risk-pledge.name": "押注",
  "contest.trump.risk-pledge.description":
    "自己赢时进攻加分增加2，对方赢时其进攻加分增加1；均受抵消与上限约束。",
  "contest.trump.forced-draw.name": "强征",
  "contest.trump.forced-draw.description":
    "对方从堆顶强制取一张明牌；需堆非空，不结束自己的行动轮，不触发要牌补给。",
  "contest.trump.redraw.name": "调度",
  "contest.trump.redraw.description":
    "自己末张明牌回堆末，再取堆顶一张；需有明牌，不触发要牌补给。",
  "contest.trump.scry.name": "窥序",
  "contest.trump.scry.description":
    "仅自己窥看堆顶最多两张及顺序；堆变化后位置标记失效，空堆仍消费。",
  "contest.trump.deck-rotate.name": "移底",
  "contest.trump.deck-rotate.description":
    "堆顶一张移至堆末且不公开数值；需剩余至少两张，使窥序位置标记失效。",
  "contest.trump.trim.name": "减负",
  "contest.trump.trim.description":
    "将自己原值至少8的明牌从左到右回堆末；需有符合条件的牌，逻辑暗牌不受影响。",
  "contest.trump.reveal-self.name": "明志",
  "contest.trump.reveal-self.description":
    "公开自己原暗牌并补最多一道具；需尚未公开，仍保留逻辑暗牌槽位。",
  "contest.trump.reveal-opponent.name": "识破",
  "contest.trump.reveal-opponent.description":
    "公开对方原暗牌，之后双方可见；需尚未公开，仍保留逻辑暗牌槽位。",
  "contest.trump.target-lock.name": "定锚",
  "contest.trump.target-lock.description":
    "至对方下轮结束，禁止新目标改变或替换当前目标；仍可清除当前目标恢复基准。",
  "contest.trump.table-exchange.name": "移花",
  "contest.trump.table-exchange.description":
    "双方各选一张可转移留场效果交换控制方，保留次数、不重放即效；压制仍绑定原效果和到期轮。",
  "contest.trump.suppress.name": "压制",
  "contest.trump.suppress.description":
    "暂停对方一张留场效果至其下轮结束；不能选压制，目标离场时同步离场，不撤销即效。",
  "contest.trump.decommission.name": "卸载",
  "contest.trump.decommission.description":
    "移除自己选定一张留场效果，再补最多一道具；不会取回已销毁卡体。",
  "contest.trump.banish-copy.name": "截流",
  "contest.trump.banish-copy.description":
    "声明公开目录定义，销毁对方剩余库存中的一个同定义实例；缺牌仍消费，不影响手牌。",
  "contest.trump.heavy-hit.name": "重担",
  "contest.trump.heavy-hit.description":
    "对方下轮若要牌则抽最多两张数字，只交权、判定补给各一次；该轮结束后离场。",
  "contest.trump.face-lighten.name": "缓步",
  "contest.trump.face-lighten.description":
    "绑定自己一张明牌，有效贡献减2且最低1；同牌同类不叠加，回堆时移除绑定效果。",
  "contest.trump.face-burden.name": "加码",
  "contest.trump.face-burden.description":
    "绑定对方一张明牌，有效贡献加2；不改原值，同牌同类不叠加。",
  "contest.trump.resonance.name": "共振",
  "contest.trump.resonance.description":
    "目标锁定为21加双方当前非暗牌槽位明牌数；替换其他目标，后续牌数变化不追算。",
  "contest.trump.supply-cache.name": "备粮",
  "contest.trump.supply-cache.description":
    "自己下次普通要牌补给门控成功时改补最多两道具后离场；门控失败不耗次数，回合末清理。",
  "contest.trump.life-trade.name": "险中求备",
  "contest.trump.life-trade.description":
    "先取堆顶一张明牌再补最多两道具；需数字堆非空，不换人、不额外判定要牌补给。",
  "contest.trump.purge-hand.name": "破釜",
  "contest.trump.purge-hand.description":
    "将自己全部其他手牌作为隐藏费用销毁，再补最多三张；须至少另一张手牌，少领不退费用。",
  "contest.trump.safe-hit.name": "避险",
  "contest.trump.safe-hit.description":
    "自己下次普通要牌首张若会爆牌则公开退至堆末，否则保留；仍结束行动轮并判定一次补给，仅一次。",
  "contest.trump.regret.name": "悔牌",
  "contest.trump.regret.description":
    "撤销上一笔可撤销出牌的实际效果；不退已销毁卡体、费用、随机、行动权或已知信息，撤销删除创建新身份。",
  "contest.trump.skill-revival.name": "回仙",
  "contest.trump.skill-revival.description":
    "已登记，主动技阶段完成前不准入；届时恢复已成功生效技能一次次数且不超初始上限，并增加本局一次发动许可。",
  "contest.trump.sudden-death.name": "赌命",
  "contest.trump.sudden-death.description":
    "本回合决胜方直接赢本局，护身不能阻止；平局将标记顺延，不直接赢整场，已有标记不可重复。",
  "contest.codex.title": "图鉴",
  "contest.codex.locked": "???",
  "contest.codex.new": "未查看",
  "contest.codex.viewed": "已查看",
  "contest.codex.experimental": "实验候选，尚未准入",

  split: "分牌",
  surrender: "投降",
  surrenderSub: "主注的一半已返还。",
  surrenderShort: "投降",
  mixed: "每手牌，各有结果。",
  mixedSub: "请查看各手结果；净收益包含保险。",
  mixedShort: "各手结果不同",
  insurance: "保险",
  insurancePhase: "选择保险",
  insure: "购买保险",
  declineInsurance: "放弃保险",
  insuranceHint: "保费为原注一半。庄家天然 Blackjack 时净赔 2:1。",
  insuranceUnaffordable: "余额不足以购买保险，请选择放弃保险继续。",
  insuranceWin: "保险获赔",
  insuranceLose: "保险损失",
  insuranceDeclined: "已放弃保险",
  activeHand: "正在行动",
  handStood: "已停牌",
  handBusted: "已爆牌",
  handWaiting: "等待行动",
  helpSplit: "初始两张同点值牌，追加同额下注，最多两手。",
  helpSurrender: "首次行动前且已排除庄家天然时可用，返还主注一半。",
  legacySave:
    "浏览器存档版本不受支持，原档尚未覆盖。请导入 v2 备份或明确选择重新开始；v1 无法迁移。",

  room: "绿 房 子",
  subtitle: "一点运气，一点直觉。",
  live: "你的专属牌桌",
  wallet: "可用筹码",
  round: "回合",
  rules: "牌桌规则",
  saves: "存档与恢复",
  settings: "设置",
  about: "关于",
  backToSettings: "返回设置",
  appVersion: "版本",
  repository: "项目仓库",
  license: "开源许可",
  mitLicense: "MIT 许可证",
  feedback: "意见反馈",
  feedbackHint: "欢迎通过 GitHub Issues 反馈问题、报告错误或提出建议。",
  openIssues: "前往 GitHub Issues",
  history: "最近对局",
  dealer: "庄 家",
  player: "你 的 手牌",
  waiting: "等待你的下注",
  turn: "下一步，由你决定",
  dealing: "好牌，慢慢揭晓",
  dealerTurn: "庄家正在行动",
  settled: "这一局，落定",
  betLabel: "本局下注",
  placeBet: "从一枚筹码开始。",
  betHint: "选择筹码，开启属于你的这一局。",
  hit: "要牌",
  stand: "停牌",
  double: "加倍",
  deal: "开始发牌",
  next: "下一局",
  undo: "撤销",
  clear: "清空",
  allIn: "全押",
  chip: "下注",
  blackjack: "天生好牌。",
  win: "这一局，属于你。",
  lose: "庄家赢下这一局。",
  push: "不分上下。",
  blackjackSub: "天然 Blackjack，净赔 3:2。",
  winSub: "相信直觉，享受胜利。",
  loseSub: "下一手，新的可能。",
  pushSub: "主注已全额返还，保险独立结算。",
  payout: "本局净收益",
  bet: "下注",
  balance: "余额",
  soft: "软",
  hidden: "暗牌",
  empty: "下一段故事，从这里开始。",
  footer: "天然 BLACKJACK 净赔 3:2",
  footer2: "庄家在所有 17 点停牌",
  practice: "虚拟筹码，纯粹乐趣。",
  close: "关闭",
  language: "界面语言",
  sound: "牌桌音效",
  volume: "音量",
  motion: "动画效果",
  system: "跟随系统",
  reduce: "减少动态",
  full: "完整动画",
  on: "开启",
  off: "关闭",
  export: "导出存档",
  import: "选择存档文件",
  saveCopy:
    "游戏进度自动保存在当前浏览器。导出文件可备份进度，也可在其他设备导入继续游戏。",
  saved: "本地自动保存",
  storage: "浏览器无法保存进度，请导出文件备份。",
  corrupt: "无法读取浏览器存档。请导入备份或开始新游戏。",
  conflict: "其他标签页已修改游戏，请载入最新进度后继续。",
  reload: "载入最新进度",
  newGame: "新游戏",
  resetTitle: "重新开始？",
  resetCopy:
    "当前游戏将被替换，重新获得 2,000 筹码。如需保留进度，请先导出备份。",
  confirmReset: "重新开始",
  cancel: "取消",
  importTitle: "恢复这份存档？",
  importCopy: "这将替换当前游戏和偏好设置。如有需要，请先导出备份。",
  confirmImport: "恢复游戏",
  invalid: "这不是有效的 Blackjack 存档，当前游戏未改变。",
  version: "暂不支持此存档版本，当前游戏未改变。",
  size: "文件过大，最大支持 128 KB。",
  noHistory: "第一局的故事，等你开启。",
  exhausted: "准备好，重新出发。",
  exhaustedCopy: "至少需要一枚筹码才能下注。你可以重新开始，或恢复已有存档。",
  rulesTitle: "入座之前",
  rulesIntro: "一位玩家，一位庄家。尽量接近 21 点，但不要超过。",
  rulesList: [
    "每局重新洗一副 52 张牌。人头牌为 10 点，A 可作 1 点或 11 点。",
    "庄家有一张暗牌。明牌为 A 时先选择保险，再检查天然 Blackjack；双方天然则平局。",
    "未分牌的两张牌天然 Blackjack 净赔 3:2，普通获胜净赔 1:1，平局退还主注。",
    "要牌可再抽一张，停牌结束行动。普通 21 点自动停牌，但不保证获胜。",
    "庄家不足 17 点必须补牌，所有 17 点均停牌，包括软 17。",
    "初始两张牌且余额足够时可加倍：追加同额下注，再抽一张，然后停牌。",
    "主注使用整筹码，保险和返还可含半筹码。全押使用全部可下注的整数筹码。",
    "初始同点值两张牌可追加同额下注分成两手，不可再次分牌。分牌 21 点不算天然；分 A 各补一张并停牌，不可加倍；其他分牌可加倍。",
    "保险为原注一半，庄家天然时净赔 2:1。保险独立结算，玩家天然也可选择。",
    "确认庄家无天然后，未要牌、加倍或分牌时可晚投降，返还主注一半；不退还已损失的保险。",
  ],
  result: "结果",
  winShort: "获胜",
  loseShort: "落败",
  pushShort: "平局",
  blackjackShort: "天然 21 点",
  fileDate: "保存时间",
  phase: "阶段",
  bettingPhase: "下注中",
  playerPhase: "玩家回合",
  settledPhase: "已结算",
  dealerPhase: "庄家回合",
  roundNote: "单副牌 · 经典规则",
  busy: "正在发牌",
  muted: "切换音效",
  helpDouble: "仅限初始两张牌，且余额足够追加同额下注。",
  cardName: "纸牌",
  showHistory: "查看最近对局",
  importReadError: "无法读取该文件，请尝试其他备份。",
};
