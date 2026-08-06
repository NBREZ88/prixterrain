// PrixTerrain — consultation par agriculteur et par fournisseur.
//
// Mêmes règles de calcul qu'à l'écran des prix par produit : seul le
// regroupement change. Un bloc par produit, une moyenne par unité à
// l'intérieur du bloc, l'autre tiers figurant dans la liste des relevés.

(function (global) {
  'use strict';

  var A = global.PrixTerrain;

  var TIERS = {
    agriculteur: {
      libelle: 'Agriculteur',
      titre: 'Prix par agriculteur',
      exemple: "Nom de l'exploitation",
      table: 'agriculteurs',
      colonne: 'agriculteur_id',
      autreTable: 'fournisseurs',
      autreColonne: 'fournisseur_id',
      autreLibelle: 'Fournisseurs rencontrés'
    },
    fournisseur: {
      libelle: 'Fournisseur',
      titre: 'Prix par fournisseur',
      exemple: 'Nom du fournisseur',
      table: 'fournisseurs',
      colonne: 'fournisseur_id',
      autreTable: 'agriculteurs',
      autreColonne: 'agriculteur_id',
      autreLibelle: 'Agriculteurs concernés'
    }
  };

  function afficherTiers(zone, compte) {
    var C = A.calculs;
    var element = C.element;
    var bouton = C.bouton;

    var typeCourant = 'agriculteur';
    var contexte = null;
    var reglages = null;

    function dessiner() {
      zone.innerHTML = '';
      var reglage = TIERS[typeCourant];

      var bandeau = element('header', 'bandeau');
      bandeau.appendChild(element('h1', null, reglage.titre));
      zone.appendChild(bandeau);

      var onglets = element('div', 'onglets');
      Object.keys(TIERS).forEach(function (type) {
        onglets.appendChild(bouton(type === typeCourant ? 'onglet actif' : 'onglet',
          TIERS[type].libelle, function () { typeCourant = type; dessiner(); }));
      });
      zone.appendChild(onglets);

      var champ = element('div', 'champ');
      champ.appendChild(element('span', 'etiquette', reglage.libelle));
      var recherche = element('input', 'saisie');
      recherche.type = 'text';
      recherche.placeholder = reglage.exemple;
      champ.appendChild(recherche);
      var propositions = element('div', 'propositions');
      propositions.style.display = 'none';
      champ.appendChild(propositions);
      zone.appendChild(champ);

      var detail = element('div');
      zone.appendChild(detail);

      recherche.addEventListener('input', function () {
        var texte = recherche.value.trim();
        if (texte.length < 3) {
          propositions.style.display = 'none';
          propositions.innerHTML = '';
          return;
        }
        A.rechercherFiches(typeCourant, texte, 8).then(function (lignes) {
          if (recherche.value.trim() !== texte) return;
          propositions.innerHTML = '';
          propositions.style.display = 'block';
          if (!lignes.length) propositions.appendChild(element('p', 'aucune', 'Rien de connu sous ce nom.'));
          lignes.forEach(function (ligne) {
            propositions.appendChild(bouton('proposition', ligne.nom, function () {
              recherche.value = '';
              propositions.style.display = 'none';
              propositions.innerHTML = '';
              afficherFiche(ligne, reglage, detail);
            }));
          });
        });
      });
    }

    function afficherFiche(fiche, reglage, detail) {
      var C = A.calculs;
      var element = C.element;

      detail.innerHTML = '';
      detail.appendChild(element('p', null, 'Lecture des relevés…'));

      A.relevesRetenus().then(function (tous) {
        var siens = tous.filter(function (r) {
          var t = C.ficheConservee(contexte[reglage.table], r[reglage.colonne]);
          return t && t.id === fiche.id;
        });

        detail.innerHTML = '';
        var entete = element('div', 'entete-produit');
        entete.appendChild(element('h2', null, fiche.nom));
        detail.appendChild(entete);

        if (!siens.length) {
          detail.appendChild(element('p', 'confirmation', 'Aucun relevé rattaché à cette fiche.'));
          return;
        }

        // Tiers d'en face rencontrés, et période couverte.
        var autres = {};
        var datePlusAncienne = null;
        siens.forEach(function (r) {
          var a = C.ficheConservee(contexte[reglage.autreTable], r[reglage.autreColonne]);
          if (a) autres[a.nom] = true;
          if (!datePlusAncienne || r.date_prix < datePlusAncienne) datePlusAncienne = r.date_prix;
        });
        entete.appendChild(element('p', 'appui',
          siens.length + (siens.length > 1 ? ' relevés' : ' relevé') +
          ' depuis le ' + C.dateFrancaise(datePlusAncienne)));
        entete.appendChild(element('p', 'appui',
          reglage.autreLibelle + ' : ' + Object.keys(autres).sort(function (a, b) {
            return a.localeCompare(b, 'fr');
          }).join(', ')));

        // Un bloc par produit conservé.
        var parProduit = {};
        siens.forEach(function (r) {
          var p = C.ficheConservee(contexte.produits, r.produit_id);
          var id = p ? p.id : 'inconnu';
          if (!parProduit[id]) parProduit[id] = { produit: p, releves: [] };
          parProduit[id].releves.push(r);
        });

        var blocs = Object.keys(parProduit).map(function (id) { return parProduit[id]; });
        blocs.sort(function (a, b) {
          if (b.releves.length !== a.releves.length) return b.releves.length - a.releves.length;
          var na = a.produit ? a.produit.nom : '';
          var nb = b.produit ? b.produit.nom : '';
          return na.localeCompare(nb, 'fr');
        });

        var reglagesSignales = {};
        var ecartes = 0;

        blocs.forEach(function (bloc) {
          var famille = bloc.produit ? bloc.produit.famille_code : '';
          var resultat = C.calculerAgregats(bloc.releves, contexte, reglages, famille,
            { grouper: function () { return null; } });

          ecartes += bloc.releves.length - resultat.retenus.length;
          if (!resultat.retenus.length) return;

          var carte = element('div', 'groupe');
          carte.appendChild(element('p', 'titre-bloc',
            bloc.produit ? bloc.produit.nom : 'Produit non retrouvé'));

          resultat.lignes.forEach(function (ligne) {
            if (ligne.calculable) {
              carte.appendChild(element('p', 'valeur-moyenne',
                C.nombreFrancais(ligne.moyenne) + ' ' + ligne.unite.libelle +
                ' — moyenne ' + (ligne.pondere ? 'pondérée' : 'non pondérée') +
                ' de ' + ligne.nombre + (ligne.nombre > 1 ? ' relevés' : ' relevé') +
                ' — plus ancien : ' + C.dateFrancaise(ligne.plusAncien)));
            } else {
              carte.appendChild(element('p', 'valeur-absente',
                'Moyenne non calculable en ' + ligne.unite.libelle + ' — ' +
                ligne.nombre + (ligne.nombre > 1 ? ' relevés' : ' relevé') +
                ' — plus ancien : ' + C.dateFrancaise(ligne.plusAncien)));
            }

            var liste = element('ul', 'liste-releves');
            ligne.releves.forEach(function (r) {
              var autre = C.ficheConservee(contexte[reglage.autreTable], r[reglage.autreColonne]);
              var item = element('li', null,
                C.dateFrancaise(r.date_prix) + ' — ' +
                C.nombreFrancais(r.prix_unitaire_ht) + ' ' + ligne.unite.libelle +
                ' — ' + (autre ? autre.nom : 'fiche non retrouvée'));

              if (ligne.calculable && resultat.seuilAtypique !== null) {
                var med = resultat.medianes[ligne.unite.code];
                if (med) {
                  var ecart = Math.abs(Number(r.prix_unitaire_ht) - med) / med * 100;
                  if (ecart > resultat.seuilAtypique) {
                    item.className = 'atypique';
                    item.appendChild(element('span', 'marque',
                      ' à vérifier : ' + C.nombreFrancais(ecart, 0) + ' % d\'écart au prix médian'));
                  }
                }
              }
              if (r.commentaire) item.appendChild(element('span', 'appui', r.commentaire));
              liste.appendChild(item);
            });
            carte.appendChild(liste);
          });

          detail.appendChild(carte);

          // Un seul encart par réglage manquant, quel que soit le nombre de blocs.
          [['duree_validite', famille], ['anciennete_exclusion', famille],
           ['nombre_minimal_releves', ''], ['decote_mensuelle', ''], ['ecart_atypique', '']]
            .forEach(function (paire) {
              if (reglages.valeur(paire[0], paire[1]) !== null) return;
              var cle = paire[0] + '|' + paire[1];
              if (reglagesSignales[cle]) return;
              reglagesSignales[cle] = true;
              detail.insertBefore(C.encartReglageManquant(reglages, paire[0], paire[1]),
                                  detail.children[1]);
            });
        });

        if (ecartes) {
          entete.appendChild(element('p', 'appui',
            ecartes + (ecartes > 1 ? ' relevés écartés' : ' relevé écarté') + ' pour ancienneté'));
        }
      });
    }

    Promise.all([A.calculs.chargerContexte(), A.calculs.chargerReglages()]).then(function (r) {
      contexte = r[0];
      reglages = r[1];
      dessiner();
    });
  }

  A.afficherTiers = afficherTiers;
})(window);
