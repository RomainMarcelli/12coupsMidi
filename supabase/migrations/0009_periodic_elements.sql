-- =============================================================================
-- 0009 — Tableau périodique (F2.1)
-- =============================================================================
-- Crée et seed la table `periodic_elements` (118 éléments).
-- Idempotent : `CREATE TABLE IF NOT EXISTS` + `INSERT ON CONFLICT DO NOTHING`.
-- En prod la table existe déjà (créée manuellement) → l'INSERT skippe.
-- En dev, le clone fresh récupère les données automatiquement.
--
-- Familles utilisées (10) :
--   alcalin / alcalino-terreux / metal-transition / metal-pauvre
--   metalloide / non-metal / halogene / gaz-noble
--   lanthanide / actinide
--
-- Grille standard (18 cols × 9 rows) :
--   - Périodes 1-7 = rows 1-7
--   - Lanthanides (57-71) = row 8
--   - Actinides (89-103) = row 9
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.periodic_elements (
  numero_atomique smallint PRIMARY KEY,
  symbole         text NOT NULL UNIQUE,
  nom             text NOT NULL,
  periode         smallint NOT NULL,
  groupe          smallint,
  famille         text NOT NULL,
  masse_atomique  numeric,
  etat_standard   text,
  grid_row        smallint NOT NULL,
  grid_col        smallint NOT NULL
);

CREATE INDEX IF NOT EXISTS periodic_elements_famille_idx
  ON public.periodic_elements (famille);
CREATE INDEX IF NOT EXISTS periodic_elements_periode_idx
  ON public.periodic_elements (periode);
CREATE INDEX IF NOT EXISTS periodic_elements_groupe_idx
  ON public.periodic_elements (groupe);

ALTER TABLE public.periodic_elements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "periodic_elements readable by authenticated"
  ON public.periodic_elements;
CREATE POLICY "periodic_elements readable by authenticated"
  ON public.periodic_elements FOR SELECT
  TO authenticated
  USING (true);

-- =============================================================================
-- SEED — 118 éléments (données standards Wikipedia)
-- =============================================================================
INSERT INTO public.periodic_elements (numero_atomique, symbole, nom, periode, groupe, famille, masse_atomique, etat_standard, grid_row, grid_col) VALUES
  (1,   'H',  'Hydrogène',     1, 1,    'non-metal',         1.008,   'gaz',     1, 1),
  (2,   'He', 'Hélium',        1, 18,   'gaz-noble',         4.0026,  'gaz',     1, 18),
  (3,   'Li', 'Lithium',       2, 1,    'alcalin',           6.94,    'solide',  2, 1),
  (4,   'Be', 'Béryllium',     2, 2,    'alcalino-terreux',  9.0122,  'solide',  2, 2),
  (5,   'B',  'Bore',          2, 13,   'metalloide',        10.81,   'solide',  2, 13),
  (6,   'C',  'Carbone',       2, 14,   'non-metal',         12.011,  'solide',  2, 14),
  (7,   'N',  'Azote',         2, 15,   'non-metal',         14.007,  'gaz',     2, 15),
  (8,   'O',  'Oxygène',       2, 16,   'non-metal',         15.999,  'gaz',     2, 16),
  (9,   'F',  'Fluor',         2, 17,   'halogene',          18.998,  'gaz',     2, 17),
  (10,  'Ne', 'Néon',          2, 18,   'gaz-noble',         20.180,  'gaz',     2, 18),
  (11,  'Na', 'Sodium',        3, 1,    'alcalin',           22.990,  'solide',  3, 1),
  (12,  'Mg', 'Magnésium',     3, 2,    'alcalino-terreux',  24.305,  'solide',  3, 2),
  (13,  'Al', 'Aluminium',     3, 13,   'metal-pauvre',      26.982,  'solide',  3, 13),
  (14,  'Si', 'Silicium',      3, 14,   'metalloide',        28.085,  'solide',  3, 14),
  (15,  'P',  'Phosphore',     3, 15,   'non-metal',         30.974,  'solide',  3, 15),
  (16,  'S',  'Soufre',        3, 16,   'non-metal',         32.06,   'solide',  3, 16),
  (17,  'Cl', 'Chlore',        3, 17,   'halogene',          35.45,   'gaz',     3, 17),
  (18,  'Ar', 'Argon',         3, 18,   'gaz-noble',         39.948,  'gaz',     3, 18),
  (19,  'K',  'Potassium',     4, 1,    'alcalin',           39.098,  'solide',  4, 1),
  (20,  'Ca', 'Calcium',       4, 2,    'alcalino-terreux',  40.078,  'solide',  4, 2),
  (21,  'Sc', 'Scandium',      4, 3,    'metal-transition',  44.956,  'solide',  4, 3),
  (22,  'Ti', 'Titane',        4, 4,    'metal-transition',  47.867,  'solide',  4, 4),
  (23,  'V',  'Vanadium',      4, 5,    'metal-transition',  50.942,  'solide',  4, 5),
  (24,  'Cr', 'Chrome',        4, 6,    'metal-transition',  51.996,  'solide',  4, 6),
  (25,  'Mn', 'Manganèse',     4, 7,    'metal-transition',  54.938,  'solide',  4, 7),
  (26,  'Fe', 'Fer',           4, 8,    'metal-transition',  55.845,  'solide',  4, 8),
  (27,  'Co', 'Cobalt',        4, 9,    'metal-transition',  58.933,  'solide',  4, 9),
  (28,  'Ni', 'Nickel',        4, 10,   'metal-transition',  58.693,  'solide',  4, 10),
  (29,  'Cu', 'Cuivre',        4, 11,   'metal-transition',  63.546,  'solide',  4, 11),
  (30,  'Zn', 'Zinc',          4, 12,   'metal-transition',  65.38,   'solide',  4, 12),
  (31,  'Ga', 'Gallium',       4, 13,   'metal-pauvre',      69.723,  'solide',  4, 13),
  (32,  'Ge', 'Germanium',     4, 14,   'metalloide',        72.630,  'solide',  4, 14),
  (33,  'As', 'Arsenic',       4, 15,   'metalloide',        74.922,  'solide',  4, 15),
  (34,  'Se', 'Sélénium',      4, 16,   'non-metal',         78.971,  'solide',  4, 16),
  (35,  'Br', 'Brome',         4, 17,   'halogene',          79.904,  'liquide', 4, 17),
  (36,  'Kr', 'Krypton',       4, 18,   'gaz-noble',         83.798,  'gaz',     4, 18),
  (37,  'Rb', 'Rubidium',      5, 1,    'alcalin',           85.468,  'solide',  5, 1),
  (38,  'Sr', 'Strontium',     5, 2,    'alcalino-terreux',  87.62,   'solide',  5, 2),
  (39,  'Y',  'Yttrium',       5, 3,    'metal-transition',  88.906,  'solide',  5, 3),
  (40,  'Zr', 'Zirconium',     5, 4,    'metal-transition',  91.224,  'solide',  5, 4),
  (41,  'Nb', 'Niobium',       5, 5,    'metal-transition',  92.906,  'solide',  5, 5),
  (42,  'Mo', 'Molybdène',     5, 6,    'metal-transition',  95.95,   'solide',  5, 6),
  (43,  'Tc', 'Technétium',    5, 7,    'metal-transition',  98,      'solide',  5, 7),
  (44,  'Ru', 'Ruthénium',     5, 8,    'metal-transition',  101.07,  'solide',  5, 8),
  (45,  'Rh', 'Rhodium',       5, 9,    'metal-transition',  102.91,  'solide',  5, 9),
  (46,  'Pd', 'Palladium',     5, 10,   'metal-transition',  106.42,  'solide',  5, 10),
  (47,  'Ag', 'Argent',        5, 11,   'metal-transition',  107.87,  'solide',  5, 11),
  (48,  'Cd', 'Cadmium',       5, 12,   'metal-transition',  112.41,  'solide',  5, 12),
  (49,  'In', 'Indium',        5, 13,   'metal-pauvre',      114.82,  'solide',  5, 13),
  (50,  'Sn', 'Étain',         5, 14,   'metal-pauvre',      118.71,  'solide',  5, 14),
  (51,  'Sb', 'Antimoine',     5, 15,   'metalloide',        121.76,  'solide',  5, 15),
  (52,  'Te', 'Tellure',       5, 16,   'metalloide',        127.60,  'solide',  5, 16),
  (53,  'I',  'Iode',          5, 17,   'halogene',          126.90,  'solide',  5, 17),
  (54,  'Xe', 'Xénon',         5, 18,   'gaz-noble',         131.29,  'gaz',     5, 18),
  (55,  'Cs', 'Césium',        6, 1,    'alcalin',           132.91,  'solide',  6, 1),
  (56,  'Ba', 'Baryum',        6, 2,    'alcalino-terreux',  137.33,  'solide',  6, 2),
  (57,  'La', 'Lanthane',      6, NULL, 'lanthanide',        138.91,  'solide',  8, 3),
  (58,  'Ce', 'Cérium',        6, NULL, 'lanthanide',        140.12,  'solide',  8, 4),
  (59,  'Pr', 'Praséodyme',    6, NULL, 'lanthanide',        140.91,  'solide',  8, 5),
  (60,  'Nd', 'Néodyme',       6, NULL, 'lanthanide',        144.24,  'solide',  8, 6),
  (61,  'Pm', 'Prométhium',    6, NULL, 'lanthanide',        145,     'solide',  8, 7),
  (62,  'Sm', 'Samarium',      6, NULL, 'lanthanide',        150.36,  'solide',  8, 8),
  (63,  'Eu', 'Europium',      6, NULL, 'lanthanide',        151.96,  'solide',  8, 9),
  (64,  'Gd', 'Gadolinium',    6, NULL, 'lanthanide',        157.25,  'solide',  8, 10),
  (65,  'Tb', 'Terbium',       6, NULL, 'lanthanide',        158.93,  'solide',  8, 11),
  (66,  'Dy', 'Dysprosium',    6, NULL, 'lanthanide',        162.50,  'solide',  8, 12),
  (67,  'Ho', 'Holmium',       6, NULL, 'lanthanide',        164.93,  'solide',  8, 13),
  (68,  'Er', 'Erbium',        6, NULL, 'lanthanide',        167.26,  'solide',  8, 14),
  (69,  'Tm', 'Thulium',       6, NULL, 'lanthanide',        168.93,  'solide',  8, 15),
  (70,  'Yb', 'Ytterbium',     6, NULL, 'lanthanide',        173.05,  'solide',  8, 16),
  (71,  'Lu', 'Lutécium',      6, NULL, 'lanthanide',        174.97,  'solide',  8, 17),
  (72,  'Hf', 'Hafnium',       6, 4,    'metal-transition',  178.49,  'solide',  6, 4),
  (73,  'Ta', 'Tantale',       6, 5,    'metal-transition',  180.95,  'solide',  6, 5),
  (74,  'W',  'Tungstène',     6, 6,    'metal-transition',  183.84,  'solide',  6, 6),
  (75,  'Re', 'Rhénium',       6, 7,    'metal-transition',  186.21,  'solide',  6, 7),
  (76,  'Os', 'Osmium',        6, 8,    'metal-transition',  190.23,  'solide',  6, 8),
  (77,  'Ir', 'Iridium',       6, 9,    'metal-transition',  192.22,  'solide',  6, 9),
  (78,  'Pt', 'Platine',       6, 10,   'metal-transition',  195.08,  'solide',  6, 10),
  (79,  'Au', 'Or',            6, 11,   'metal-transition',  196.97,  'solide',  6, 11),
  (80,  'Hg', 'Mercure',       6, 12,   'metal-transition',  200.59,  'liquide', 6, 12),
  (81,  'Tl', 'Thallium',      6, 13,   'metal-pauvre',      204.38,  'solide',  6, 13),
  (82,  'Pb', 'Plomb',         6, 14,   'metal-pauvre',      207.2,   'solide',  6, 14),
  (83,  'Bi', 'Bismuth',       6, 15,   'metal-pauvre',      208.98,  'solide',  6, 15),
  (84,  'Po', 'Polonium',      6, 16,   'metalloide',        209,     'solide',  6, 16),
  (85,  'At', 'Astate',        6, 17,   'halogene',          210,     'solide',  6, 17),
  (86,  'Rn', 'Radon',         6, 18,   'gaz-noble',         222,     'gaz',     6, 18),
  (87,  'Fr', 'Francium',      7, 1,    'alcalin',           223,     'solide',  7, 1),
  (88,  'Ra', 'Radium',        7, 2,    'alcalino-terreux',  226,     'solide',  7, 2),
  (89,  'Ac', 'Actinium',      7, NULL, 'actinide',          227,     'solide',  9, 3),
  (90,  'Th', 'Thorium',       7, NULL, 'actinide',          232.04,  'solide',  9, 4),
  (91,  'Pa', 'Protactinium',  7, NULL, 'actinide',          231.04,  'solide',  9, 5),
  (92,  'U',  'Uranium',       7, NULL, 'actinide',          238.03,  'solide',  9, 6),
  (93,  'Np', 'Neptunium',     7, NULL, 'actinide',          237,     'solide',  9, 7),
  (94,  'Pu', 'Plutonium',     7, NULL, 'actinide',          244,     'solide',  9, 8),
  (95,  'Am', 'Américium',     7, NULL, 'actinide',          243,     'solide',  9, 9),
  (96,  'Cm', 'Curium',        7, NULL, 'actinide',          247,     'solide',  9, 10),
  (97,  'Bk', 'Berkélium',     7, NULL, 'actinide',          247,     'solide',  9, 11),
  (98,  'Cf', 'Californium',   7, NULL, 'actinide',          251,     'solide',  9, 12),
  (99,  'Es', 'Einsteinium',   7, NULL, 'actinide',          252,     'solide',  9, 13),
  (100, 'Fm', 'Fermium',       7, NULL, 'actinide',          257,     'solide',  9, 14),
  (101, 'Md', 'Mendélévium',   7, NULL, 'actinide',          258,     'solide',  9, 15),
  (102, 'No', 'Nobélium',      7, NULL, 'actinide',          259,     'solide',  9, 16),
  (103, 'Lr', 'Lawrencium',    7, NULL, 'actinide',          266,     'solide',  9, 17),
  (104, 'Rf', 'Rutherfordium', 7, 4,    'metal-transition',  267,     'solide',  7, 4),
  (105, 'Db', 'Dubnium',       7, 5,    'metal-transition',  268,     'solide',  7, 5),
  (106, 'Sg', 'Seaborgium',    7, 6,    'metal-transition',  269,     'solide',  7, 6),
  (107, 'Bh', 'Bohrium',       7, 7,    'metal-transition',  270,     'solide',  7, 7),
  (108, 'Hs', 'Hassium',       7, 8,    'metal-transition',  269,     'solide',  7, 8),
  (109, 'Mt', 'Meitnerium',    7, 9,    'metal-transition',  278,     'solide',  7, 9),
  (110, 'Ds', 'Darmstadtium',  7, 10,   'metal-transition',  281,     'solide',  7, 10),
  (111, 'Rg', 'Roentgenium',   7, 11,   'metal-transition',  282,     'solide',  7, 11),
  (112, 'Cn', 'Copernicium',   7, 12,   'metal-transition',  285,     'solide',  7, 12),
  (113, 'Nh', 'Nihonium',      7, 13,   'metal-pauvre',      286,     'solide',  7, 13),
  (114, 'Fl', 'Flérovium',     7, 14,   'metal-pauvre',      289,     'solide',  7, 14),
  (115, 'Mc', 'Moscovium',     7, 15,   'metal-pauvre',      290,     'solide',  7, 15),
  (116, 'Lv', 'Livermorium',   7, 16,   'metal-pauvre',      293,     'solide',  7, 16),
  (117, 'Ts', 'Tennesse',      7, 17,   'halogene',          294,     'solide',  7, 17),
  (118, 'Og', 'Oganesson',     7, 18,   'gaz-noble',         294,     'gaz',     7, 18)
ON CONFLICT (numero_atomique) DO NOTHING;
