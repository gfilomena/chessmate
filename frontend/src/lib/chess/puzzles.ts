/**
 * Puzzle curriculum — 10 livelli sequenziali.
 * Puzzles reali da Lichess Open Puzzle Database (https://database.lichess.org/).
 *
 * Ogni livello contiene 4 puzzle del tema corrispondente.
 * In ogni puzzle `solution` = mosse UCI alternate giocatore/avversario/giocatore...
 *
 * Generato automaticamente con:
 *   node frontend/scripts/fetch_puzzles.mjs > frontend/src/lib/chess/puzzles.ts
 */

export interface LichessPuzzle {
    /** ID Lichess del puzzle */
    id:       string;
    /** FEN della posizione mostrata al giocatore (dopo l'ultima mossa avversaria) */
    fen:      string;
    /** Mosse UCI alternanti: [mossa_giocatore, risposta_avversario, mossa_giocatore, ...] */
    solution: string[];
    themes:   string[];
    rating:   number;
}

export interface PuzzleLevel {
    id:         number;
    title:      string;
    subtitle:   string;
    icon:       string;
    difficulty: 1 | 2 | 3;
    theme:      string;
    puzzles:    LichessPuzzle[];
    count?:     number;  // fetch script only, not used by UI
}

export const PUZZLE_LEVELS: PuzzleLevel[] = [
  {
    "id": 1,
    "title": "Matto in Uno",
    "subtitle": "Trova il colpo finale",
    "icon": "☠️",
    "difficulty": 1,
    "theme": "mateIn1",
    "count": 4,
    "puzzles": [
      {
        "id": "oCCUP",
        "fen": "6qk/8/4QKpp/p4p2/2B5/7P/6P1/8 b - - 10 47",
        "solution": [
          "g8g7"
        ],
        "themes": [
          "mateIn1"
        ],
        "rating": 1416
      },
      {
        "id": "bhAz0",
        "fen": "7k/p6p/1p1Q2p1/2p1r3/2P1p3/1P3Pq1/P5P1/5K2 w - - 0 33",
        "solution": [
          "d6f8"
        ],
        "themes": [
          "mateIn1"
        ],
        "rating": 1383
      },
      {
        "id": "N7UAB",
        "fen": "2k1r3/pbpp2q1/1p6/3n2pQ/1P1P1pP1/2PB1P2/PK6/5N2 w - - 0 31",
        "solution": [
          "h5e8"
        ],
        "themes": [
          "mateIn1"
        ],
        "rating": 1392
      },
      {
        "id": "W2344",
        "fen": "r4Nk1/pb3pp1/1p2p2p/8/3P1K2/PN1Q1P1P/1P4q1/2R2R2 b - - 0 25",
        "solution": [
          "g2g5"
        ],
        "themes": [
          "mateIn1"
        ],
        "rating": 1374
      }
    ]
  },
  {
    "id": 2,
    "title": "Cattura!",
    "subtitle": "Il pezzo è indifeso",
    "icon": "🎯",
    "difficulty": 1,
    "theme": "hangingPiece",
    "count": 4,
    "puzzles": [
      {
        "id": "mrrkO",
        "fen": "1b4k1/1N6/p2P3p/2p3p1/2Q2q2/5N2/PP2rPP1/3R2K1 b - - 0 30",
        "solution": [
          "f4c4",
          "d6d7",
          "b8c7",
          "d7d8q",
          "c7d8"
        ],
        "themes": [
          "crushing",
          "quietMove",
          "hangingPiece"
        ],
        "rating": 1607
      },
      {
        "id": "1QqoG",
        "fen": "8/5Qbk/R7/1p4p1/1P2p3/P3P1P1/1r3PP1/qB4K1 b - - 0 38",
        "solution": [
          "b2b1",
          "g1h2",
          "b1h1"
        ],
        "themes": [
          "hangingPiece",
          "mateIn2"
        ],
        "rating": 1464
      },
      {
        "id": "mE2IU",
        "fen": "5rk1/p1p2ppp/4Bb2/8/8/2N3P1/PrP1PP1P/3RK2R b K - 0 14",
        "solution": [
          "f6c3",
          "e1f1",
          "f7e6"
        ],
        "themes": [
          "crushing",
          "intermezzo",
          "hangingPiece"
        ],
        "rating": 1463
      },
      {
        "id": "Iituh",
        "fen": "6k1/2p2pp1/4b2p/2B1r3/1R6/1rN4P/2R3PK/8 b - - 1 33",
        "solution": [
          "e5c5",
          "b4b3",
          "e6b3"
        ],
        "themes": [
          "advantage",
          "hangingPiece",
          "master"
        ],
        "rating": 1271
      }
    ]
  },
  {
    "id": 3,
    "title": "La Forchetta",
    "subtitle": "Attacca due pezzi insieme",
    "icon": "🍴",
    "difficulty": 1,
    "theme": "fork",
    "count": 4,
    "puzzles": [
      {
        "id": "UkNC3",
        "fen": "3r4/1kpb4/1p1p3p/1P1Pb3/1PQ2p2/5PrP/R1P4K/8 w - - 1 27",
        "solution": [
          "a2a7",
          "b7a7",
          "c4c7",
          "a7a8",
          "c7d8"
        ],
        "themes": [
          "deflection",
          "crushing",
          "attraction",
          "fork",
          "sacrifice"
        ],
        "rating": 1396
      },
      {
        "id": "URBT2",
        "fen": "2r1R3/5ppk/7p/1Q6/8/1P5P/r2q1PP1/6K1 w - - 3 40",
        "solution": [
          "b5f5",
          "g7g6",
          "f5f7"
        ],
        "themes": [
          "fork",
          "mateIn2"
        ],
        "rating": 1416
      },
      {
        "id": "NAvUw",
        "fen": "2r3k1/p2n2pp/1pp1Rpq1/3n4/3P4/1Q3NP1/PPP2PP1/6K1 w - - 2 21",
        "solution": [
          "e6c6",
          "c8c6",
          "b3d5",
          "g6f7",
          "d5c6"
        ],
        "themes": [
          "advantage",
          "attraction",
          "fork",
          "capturingDefender",
          "pin"
        ],
        "rating": 1529
      },
      {
        "id": "b8vEC",
        "fen": "r3b2k/6p1/3qp1Qp/p1ppN3/3P3P/4P3/PK4P1/7R w - - 1 25",
        "solution": [
          "g6e8",
          "a8e8",
          "e5f7",
          "h8h7",
          "f7d6"
        ],
        "themes": [
          "advantage",
          "fork",
          "sacrifice"
        ],
        "rating": 1561
      }
    ]
  },
  {
    "id": 4,
    "title": "L'Inchiodatura",
    "subtitle": "Blocca il pezzo avversario",
    "icon": "📌",
    "difficulty": 2,
    "theme": "pin",
    "count": 4,
    "puzzles": [
      {
        "id": "TDGBC",
        "fen": "5rk1/6p1/2p1qp1p/N2b4/2Bp4/P6P/2Q2PP1/1R5K b - - 3 34",
        "solution": [
          "e6h3",
          "h1g1",
          "h3g2"
        ],
        "themes": [
          "mateIn2",
          "pin"
        ],
        "rating": 1571
      },
      {
        "id": "KSvVE",
        "fen": "r1bq3r/3kb3/p3p3/1p1pP1p1/6Bp/P1P1P2P/5PP1/R2Q1RK1 w - - 0 20",
        "solution": [
          "d1d5",
          "d7c7",
          "d5a8"
        ],
        "themes": [
          "advantage",
          "pin"
        ],
        "rating": 1514
      },
      {
        "id": "hLzSr",
        "fen": "3r2k1/1p1r1p2/p2P1np1/P1p1p2q/2B1Pb2/1PPQ1N1P/4K1R1/6R1 w - - 0 33",
        "solution": [
          "g2g6",
          "g8h8",
          "g6f6"
        ],
        "themes": [
          "crushing",
          "kingsideAttack",
          "pin",
          "master"
        ],
        "rating": 1530
      },
      {
        "id": "8NuWW",
        "fen": "6k1/R4p1p/1p4p1/8/3b4/3B2KP/P4PP1/2r5 b - - 4 28",
        "solution": [
          "c1c3",
          "g3f3",
          "c3d3"
        ],
        "themes": [
          "advantage",
          "pin"
        ],
        "rating": 1614
      }
    ]
  },
  {
    "id": 5,
    "title": "Lo Spiedino",
    "subtitle": "Attacca attraverso il pezzo",
    "icon": "🗡",
    "difficulty": 2,
    "theme": "skewer",
    "count": 4,
    "puzzles": [
      {
        "id": "3rObM",
        "fen": "5r1k/p5pp/8/1Q6/4B3/2RK1P2/PPP5/6q1 b - - 3 41",
        "solution": [
          "g1f1",
          "d3d2",
          "f1b5"
        ],
        "themes": [
          "crushing",
          "skewer"
        ],
        "rating": 1591
      },
      {
        "id": "dZDH5",
        "fen": "8/7p/6p1/7k/1P2QP2/P3PK2/7P/1q6 b - - 0 41",
        "solution": [
          "b1h1",
          "f3e2",
          "h1e4"
        ],
        "themes": [
          "deflection",
          "crushing",
          "skewer",
          "queenEndgame"
        ],
        "rating": 1434
      },
      {
        "id": "FRsqd",
        "fen": "5k1r/3q3p/4pppP/Q3P1P1/4PP2/4BK2/8/8 w - - 0 48",
        "solution": [
          "a5a8",
          "f8f7",
          "a8h8"
        ],
        "themes": [
          "crushing",
          "skewer"
        ],
        "rating": 1532
      },
      {
        "id": "JBgK9",
        "fen": "2rqr1k1/p3bppp/1p6/3P4/3Q4/1P4P1/PB1P1P1P/R4RK1 b - - 2 17",
        "solution": [
          "e7f6",
          "d4d3",
          "f6b2"
        ],
        "themes": [
          "advantage",
          "skewer"
        ],
        "rating": 1556
      }
    ]
  },
  {
    "id": 6,
    "title": "Attacco di Scoperta",
    "subtitle": "Svela un attacco nascosto",
    "icon": "👁",
    "difficulty": 2,
    "theme": "discoveredAttack",
    "count": 4,
    "puzzles": [
      {
        "id": "rFgBH",
        "fen": "r1b1kr2/pp1p2pp/2p5/4PP2/2B1Qn1q/2B5/PPP3PP/R4RK1 b q - 4 16",
        "solution": [
          "f4h3",
          "g2h3",
          "h4e4"
        ],
        "themes": [
          "advantage",
          "kingsideAttack",
          "discoveredAttack"
        ],
        "rating": 1527
      },
      {
        "id": "BJkFL",
        "fen": "3r2k1/pp1r1ppp/b1p5/4P3/1P1qBPP1/P1RP3P/3Q2K1/3R4 b - - 6 29",
        "solution": [
          "d4e4",
          "d3e4",
          "d7d2",
          "d1d2",
          "d8d2"
        ],
        "themes": [
          "advantage",
          "discoveredAttack"
        ],
        "rating": 1318
      },
      {
        "id": "PYsu4",
        "fen": "2rr2k1/p2n1p1p/1p2P1q1/2p3p1/1P2R3/PN6/3Q1PPP/4R1K1 b - - 0 25",
        "solution": [
          "d7f6",
          "e6e7",
          "d8d2"
        ],
        "themes": [
          "advantage",
          "discoveredAttack",
          "master"
        ],
        "rating": 1501
      },
      {
        "id": "ELUtJ",
        "fen": "3r1bk1/6pp/p3qp2/2n1pN2/6Q1/1p2P3/5PPP/BR4K1 w - - 4 32",
        "solution": [
          "f5h6",
          "g8h8",
          "g4e6",
          "c5e6",
          "h6f7",
          "h8g8",
          "f7d8"
        ],
        "themes": [
          "veryLong",
          "advantage",
          "fork",
          "discoveredAttack",
          "pin"
        ],
        "rating": 1313
      }
    ]
  },
  {
    "id": 7,
    "title": "Doppio Scacco",
    "subtitle": "Colpisci con due pezzi",
    "icon": "⚡",
    "difficulty": 2,
    "theme": "doubleCheck",
    "count": 4,
    "puzzles": [
      {
        "id": "BSDcU",
        "fen": "8/5P1Q/pqpkp1p1/3p4/8/2P5/PP3nPP/1R3RK1 b - - 2 29",
        "solution": [
          "f2h3",
          "g1h1",
          "b6g1",
          "f1g1",
          "h3f2"
        ],
        "themes": [
          "mateIn3",
          "sacrifice",
          "smotheredMate",
          "doubleCheck"
        ],
        "rating": 1366
      },
      {
        "id": "GGA93",
        "fen": "3r1k1r/1p4pp/4p3/pBb4q/Pn3Bn1/5R1P/1P2N1P1/5R1K w - - 0 25",
        "solution": [
          "f4d6",
          "f8g8",
          "f3f8",
          "d8f8",
          "f1f8"
        ],
        "themes": [
          "operaMate",
          "discoveredCheck",
          "mateIn3",
          "doubleCheck"
        ],
        "rating": 1374
      },
      {
        "id": "dfrDo",
        "fen": "r1b2r1k/2p2p2/pp3R1p/4Q1qp/8/7P/6PK/8 w - - 1 40",
        "solution": [
          "f6h6",
          "h8g8",
          "e5g5"
        ],
        "themes": [
          "discoveredCheck",
          "doubleCheck",
          "mateIn2"
        ],
        "rating": 1432
      },
      {
        "id": "uLLrQ",
        "fen": "rn1qkbnr/ppp2ppp/8/8/3PN3/5b2/PPP1QPPP/R1B1KB1R w KQkq - 0 8",
        "solution": [
          "e4f6"
        ],
        "themes": [
          "discoveredCheck",
          "epauletteMate",
          "mateIn1",
          "doubleCheck"
        ],
        "rating": 1619
      }
    ]
  },
  {
    "id": 8,
    "title": "Matto in Due",
    "subtitle": "Forza il matto in due mosse",
    "icon": "♛",
    "difficulty": 3,
    "theme": "mateIn2",
    "count": 4,
    "puzzles": [
      {
        "id": "HHbxq",
        "fen": "4kq2/4b2p/4Qp2/4pN2/3p4/6P1/5P2/6K1 w - - 9 49",
        "solution": [
          "f5d6",
          "e8d8",
          "e6c8"
        ],
        "themes": [
          "master",
          "mateIn2"
        ],
        "rating": 1468
      },
      {
        "id": "Z8Ps3",
        "fen": "8/2k4p/3b1Qp1/3P1n2/8/1P3P2/PB2r2P/6K1 b - - 0 29",
        "solution": [
          "d6h2",
          "g1f1",
          "f5g3"
        ],
        "themes": [
          "cornerMate",
          "mateIn2"
        ],
        "rating": 1444
      },
      {
        "id": "BDQaw",
        "fen": "1k1r2r1/p1p2Rb1/1p1p4/3Q2q1/3BP2p/2P5/PP4PP/5RK1 b - - 8 24",
        "solution": [
          "g7d4",
          "c3d4",
          "g5g2"
        ],
        "themes": [
          "mateIn2",
          "kingsideAttack"
        ],
        "rating": 1440
      },
      {
        "id": "Nm9Wq",
        "fen": "6r1/pp2k3/2p1p1q1/4B3/3PN3/2P1Q3/PP4rP/5R1K b - - 6 33",
        "solution": [
          "g2h2",
          "e5h2",
          "g6g2"
        ],
        "themes": [
          "clearance",
          "mateIn2",
          "sacrifice"
        ],
        "rating": 1475
      }
    ]
  },
  {
    "id": 9,
    "title": "Il Sacrificio",
    "subtitle": "Sacrifica per vincere",
    "icon": "💎",
    "difficulty": 3,
    "theme": "sacrifice",
    "count": 4,
    "puzzles": [
      {
        "id": "ekaP8",
        "fen": "r3q1rk/1p5n/pbppbPp1/4p1B1/4P1Q1/2NP3R/1PP3BK/R7 w - - 2 27",
        "solution": [
          "h3h7",
          "h8h7",
          "g4h4"
        ],
        "themes": [
          "mateIn2",
          "attraction",
          "sacrifice",
          "kingsideAttack"
        ],
        "rating": 1259
      },
      {
        "id": "Wknt4",
        "fen": "6k1/1p1Q1pp1/2n1p2p/p7/P1P4P/1Pq2NP1/5PK1/8 b - - 1 27",
        "solution": [
          "c3f3",
          "g2f3",
          "c6e5",
          "f3f4",
          "e5d7"
        ],
        "themes": [
          "master",
          "crushing",
          "attraction",
          "fork",
          "sacrifice"
        ],
        "rating": 1562
      },
      {
        "id": "oP3z3",
        "fen": "r4rk1/1p3ppp/p3p3/1bqpP3/5P2/3B1R2/P1P1Q1PP/4R2K w - - 2 20",
        "solution": [
          "d3h7",
          "g8h7",
          "f3h3",
          "h7g8",
          "e2h5"
        ],
        "themes": [
          "clearance",
          "advantage",
          "attraction",
          "sacrifice",
          "kingsideAttack"
        ],
        "rating": 1527
      },
      {
        "id": "9Cpf1",
        "fen": "8/8/1R2n3/4kppp/4N3/3r1PPP/6K1/8 w - - 0 43",
        "solution": [
          "b6e6",
          "e5e6",
          "e4c5",
          "e6d5",
          "c5d3"
        ],
        "themes": [
          "crushing",
          "attraction",
          "fork",
          "sacrifice"
        ],
        "rating": 1561
      }
    ]
  },
  {
    "id": 10,
    "title": "Maestro",
    "subtitle": "La prova finale",
    "icon": "🏆",
    "difficulty": 3,
    "theme": "crushing",
    "count": 4,
    "puzzles": [
      {
        "id": "sDhUu",
        "fen": "4k1r1/r1q4p/4pQpB/2p2p2/Pp1n4/2pR4/1b3PP1/3R3K w - - 4 27",
        "solution": [
          "d3d4",
          "c5d4",
          "f6e6",
          "c7e7",
          "e6g8"
        ],
        "themes": [
          "exposedKing",
          "crushing",
          "fork",
          "capturingDefender"
        ],
        "rating": 1589
      },
      {
        "id": "uKEoF",
        "fen": "8/1pk1B3/8/p4P2/3qb1Q1/1P6/P1P5/1K6 b - - 0 37",
        "solution": [
          "e4c2",
          "b1c2",
          "d4g4"
        ],
        "themes": [
          "crushing",
          "discoveredAttack"
        ],
        "rating": 1473
      },
      {
        "id": "ZaQDj",
        "fen": "2rq1rk1/4bppp/3p4/3Bp3/3nP3/1P6/5PPP/R1BQK2R b KQ - 0 18",
        "solution": [
          "d4c2",
          "e1f1",
          "c2a1"
        ],
        "themes": [
          "crushing",
          "fork"
        ],
        "rating": 1563
      },
      {
        "id": "AlSI8",
        "fen": "8/5p2/8/3p4/7P/2k2KP1/8/8 b - - 0 41",
        "solution": [
          "d5d4",
          "f3e2",
          "c3c2"
        ],
        "themes": [
          "master",
          "crushing",
          "quietMove",
          "pawnEndgame",
          "defensiveMove"
        ],
        "rating": 1469
      }
    ]
  }
];

export function getPuzzleLevel(id: number): PuzzleLevel | undefined {
    return PUZZLE_LEVELS.find(l => l.id === id);
}

export const TOTAL_LEVELS = PUZZLE_LEVELS.length;
