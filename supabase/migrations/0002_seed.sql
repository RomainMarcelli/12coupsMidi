-- =============================================================================
-- Midi Master — Seed catégories / sous-catégories / badges
-- =============================================================================
-- Lance cette migration APRÈS 0001_init.sql (ordre de numérotation respecté).
-- Idempotente : utilise ON CONFLICT pour pouvoir être rejouée sans erreur.
--
-- Les questions elles-mêmes ne sont PAS dans ce SQL — elles sont dans
-- src/data/seed-questions.json et insérées via `npm run seed`
-- (qui utilise SUPABASE_SERVICE_ROLE_KEY).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Catégories (14)
-- -----------------------------------------------------------------------------
-- "emoji" contient un emoji décoratif stocké en base (référence visuelle).
-- L'UI de Midi Master n'affiche PAS les emojis — elle utilise des icônes Lucide
-- (cf. src/lib/category-icons.ts). Mais on garde la colonne peuplée pour
-- rester fidèle au schéma.

insert into public.categories (nom, slug, emoji, couleur) values
  ('Histoire',    'histoire',    '🏛️', '#E07A5F'),
  ('Géographie',  'geographie',  '🌍', '#3D5A80'),
  ('Sport',       'sport',       '⚽', '#2ECC71'),
  ('Art',         'art',         '🎨', '#B983FF'),
  ('Littérature', 'litterature', '📚', '#8E7F5F'),
  ('SVT',         'svt',         '🧬', '#27AE60'),
  ('Chimie',      'chimie',      '⚗️', '#16A085'),
  ('Physique',    'physique',    '⚛️', '#2980B9'),
  ('Jeu vidéo',   'jeu-video',   '🎮', '#9B59B6'),
  ('Actualité',   'actualite',   '📰', '#E67E22'),
  ('Cinéma/TV',   'cinema-tv',   '🎬', '#E84393'),
  ('Musique',     'musique',     '🎵', '#FD79A8'),
  ('Gastronomie', 'gastronomie', '🍽️', '#D35400'),
  ('Culture G',   'culture-g',   '💡', '#F5C518')
on conflict (slug) do update
  set nom = excluded.nom,
      emoji = excluded.emoji,
      couleur = excluded.couleur;

-- -----------------------------------------------------------------------------
-- Sous-catégories
-- -----------------------------------------------------------------------------

with cats as (select id, slug from public.categories)
insert into public.subcategories (category_id, nom, slug)
select c.id, sc.nom, sc.slug from (values
  -- Histoire
  ('histoire', 'Antiquité',        'antiquite'),
  ('histoire', 'Moyen-Âge',        'moyen-age'),
  ('histoire', 'Renaissance',      'renaissance'),
  ('histoire', 'Révolution',       'revolution'),
  ('histoire', 'XIXe siècle',      'xixe'),
  ('histoire', 'XXe siècle',       'xxe'),
  ('histoire', 'Contemporain',     'contemporain'),
  -- Géographie
  ('geographie', 'France',         'france'),
  ('geographie', 'Europe',         'europe'),
  ('geographie', 'Monde',          'monde'),
  ('geographie', 'Capitales',      'capitales'),
  ('geographie', 'Drapeaux',       'drapeaux'),
  ('geographie', 'Fleuves/Montagnes', 'fleuves-montagnes'),
  -- Sport
  ('sport', 'Football',            'football'),
  ('sport', 'Tennis',              'tennis'),
  ('sport', 'JO',                  'jo'),
  ('sport', 'Rugby',               'rugby'),
  ('sport', 'Cyclisme',            'cyclisme'),
  ('sport', 'Autres',              'autres'),
  -- Art
  ('art', 'Peinture',              'peinture'),
  ('art', 'Sculpture',             'sculpture'),
  ('art', 'Architecture',          'architecture'),
  ('art', 'Cinéma',                'art-cinema'),
  ('art', 'Musique classique',     'musique-classique'),
  -- Littérature
  ('litterature', 'Classiques FR', 'classiques-fr'),
  ('litterature', 'Romans étrangers', 'romans-etrangers'),
  ('litterature', 'Poésie',        'poesie'),
  ('litterature', 'BD',            'bd'),
  -- SVT
  ('svt', 'Corps humain',          'corps-humain'),
  ('svt', 'Animaux',               'animaux'),
  ('svt', 'Plantes',               'plantes'),
  ('svt', 'Écologie',              'ecologie'),
  -- Chimie
  ('chimie', 'Éléments',           'elements'),
  ('chimie', 'Réactions',          'reactions'),
  ('chimie', 'Vie quotidienne',    'vie-quotidienne'),
  -- Physique
  ('physique', 'Mécanique',        'mecanique'),
  ('physique', 'Optique',          'optique'),
  ('physique', 'Astronomie',       'astronomie'),
  ('physique', 'Électricité',      'electricite'),
  -- Jeu vidéo
  ('jeu-video', 'Rétro',           'retro'),
  ('jeu-video', 'Consoles',        'consoles'),
  ('jeu-video', 'Licences',        'licences'),
  ('jeu-video', 'Esport',          'esport'),
  -- Actualité
  ('actualite', 'Politique',       'politique'),
  ('actualite', 'Économie',        'economie'),
  ('actualite', 'Société',         'societe'),
  ('actualite', 'People',          'people'),
  -- Cinéma/TV
  ('cinema-tv', 'Films cultes',    'films-cultes'),
  ('cinema-tv', 'Séries',          'series'),
  ('cinema-tv', 'Acteurs',         'acteurs'),
  ('cinema-tv', 'Oscars/César',    'oscars-cesar'),
  -- Musique
  ('musique', 'Chanson FR',        'chanson-fr'),
  ('musique', 'Rock/Pop',          'rock-pop'),
  ('musique', 'Rap',               'rap'),
  ('musique', 'Classique',         'musique-classique-genre'),
  -- Gastronomie
  ('gastronomie', 'Cuisine FR',    'cuisine-fr'),
  ('gastronomie', 'Du monde',      'du-monde'),
  ('gastronomie', 'Vins',          'vins'),
  ('gastronomie', 'Ingrédients',   'ingredients'),
  -- Culture G
  ('culture-g', 'Inventions',      'inventions'),
  ('culture-g', 'Mythologie',      'mythologie'),
  ('culture-g', 'Religions',       'religions'),
  ('culture-g', 'Langues',         'langues')
) as sc(cat_slug, nom, slug)
join cats c on c.slug = sc.cat_slug
on conflict (category_id, slug) do update
  set nom = excluded.nom;

-- -----------------------------------------------------------------------------
-- Badges
-- -----------------------------------------------------------------------------
-- Le champ "icone" stocke un nom de composant Lucide (cf. lucide-react).
-- L'UI affiche l'icône correspondante via un mapping.

insert into public.badges (code, nom, description, icone) values
  ('first_game',              'Première partie',       'Termine ta toute première partie.',                              'Sparkles'),
  ('streak_5',                'Série de 5',            '5 bonnes réponses d''affilée.',                                   'Flame'),
  ('streak_10',               'Série de 10',           '10 bonnes réponses d''affilée.',                                  'Flame'),
  ('streak_20',               'Série de 20',           '20 bonnes réponses d''affilée — phénoménal.',                     'Flame'),
  ('perfect_jeu1',            'Quizz parfait',         '10/10 au Jeu 1 sans perdre une vie.',                             'Dices'),
  ('etoile_first_try',        'Étoile filante',        'Étoile Mystérieuse trouvée au premier indice.',                   'Star'),
  ('face_a_face_win_bot_hard','Face-à-Face difficile', 'Victoire contre le bot en mode difficile.',                       'Sword'),
  ('maitre_midi',             'Maître de Midi',        'Coup de Maître : 4 célébrités identifiées en 45 secondes.',       'Crown'),
  ('parcours_parfait',        'Parcours parfait',      'Parcours complet enchaîné sans la moindre erreur.',               'Trophy'),
  ('revisionniste',           'Révisionniste',         '50 questions révisées avec succès.',                              'BookOpen'),
  ('encyclopedie',            'Encyclopédie',          '80 % de réussite sur une catégorie (min 20 questions jouées).',   'GraduationCap')
on conflict (code) do update
  set nom = excluded.nom,
      description = excluded.description,
      icone = excluded.icone;
