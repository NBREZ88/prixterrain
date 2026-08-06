-- PrixTerrain — 04_releve_sans_agriculteur.sql
-- À exécuter dans l'éditeur SQL, après les trois fichiers du lot 1.
--
-- Un relevé ne porte plus l'agriculteur. La colonne agriculteur_id n'est pas
-- supprimée : la retirer réécrirait les relevés déjà enregistrés, ce que la
-- règle d'ajout seul interdit. Elle reste en place, gelée, et conserve
-- l'information des relevés antérieurs. Plus aucun relevé nouveau ne la
-- renseigne.

begin;

alter table public.releve drop constraint releve_prix_complet;

alter table public.releve add constraint releve_prix_complet check (
  type <> 'prix' or (
    date_prix is not null and
    fournisseur_id is not null and
    produit_id is not null and
    prix_unitaire_ht is not null and
    unite_code is not null and
    releve_annule_id is null)
);

comment on column public.releve.agriculteur_id is
  'Colonne gelée : les relevés enregistrés avant le retrait de l''agriculteur la portent encore, aucun relevé nouveau ne la renseigne.';

comment on table public.agriculteur is
  'Table gelée : conservée pour les relevés antérieurs au retrait de l''agriculteur. L''application n''y écrit plus.';

commit;

-- Contrôle : doit renvoyer le nombre de relevés portant encore un agriculteur.
select count(*) as releves_avec_agriculteur
from public.releve
where agriculteur_id is not null;
