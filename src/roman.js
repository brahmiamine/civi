// « Chiffres romains » (Profil) : ce qu'il faut savoir lire pour le test (Ve République, XVe siècle, Louis XIV…).
// Les chiffres romains affichés sont calculés par toRoman(), donc toujours justes.
const TABLE = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];

export function toRoman(n) {
  let out = '';
  TABLE.forEach(([v, s]) => { while (n >= v) { out += s; n -= v; } });
  return out;
}

// Ordinal as written in French with Roman numerals: Ier, IIe, XVe…
export const romanOrdinal = (n) => toRoman(n) + (n === 1 ? 'er' : 'e');

export const SYMBOLS = [
  ['I', 1, 'Un'], ['V', 5, 'Cinq'], ['X', 10, 'Dix'], ['L', 50, 'Cinquante'], ['C', 100, 'Cent'], ['D', 500, 'Cinq cents'], ['M', 1000, 'Mille'],
];

export const RULES = [
  ['Les symboles s’additionnent', 'VI = 5 + 1 = 6 · XV = 10 + 5 = 15 · XX = 20'],
  ['Un symbole plus petit placé avant se soustrait', 'IV = 4 · IX = 9 · XL = 40 · XC = 90 · CD = 400 · CM = 900'],
  ['Jamais plus de trois fois le même symbole', 'III = 3, mais 4 s’écrit IV (et non IIII)'],
  ['« er » ou « e » indique le rang', 'Ier = premier · Ve = cinquième · XVe = quinzième'],
];

// [nombre, texte avant, texte après, explication] — le chiffre romain est ajouté entre les deux textes.
export const EXAMPLES = [
  [5, '', 'e République', 'Cinquième République · depuis la Constitution du 4 octobre 1958'],
  [4, '', 'e République', 'Quatrième République · 1946 à 1958'],
  [3, '', 'e République', 'Troisième République · 1870 à 1940'],
  [1, 'Napoléon ', 'er', 'Napoléon premier · Premier Empire, 1804 à 1815'],
  [3, 'Napoléon ', '', 'Napoléon trois · Second Empire, 1852 à 1870'],
  [14, 'Louis ', '', 'Louis quatorze · le « Roi-Soleil », règne de 1643 à 1715'],
  [16, 'Louis ', '', 'Louis seize · dernier roi avant la République, exécuté en 1793'],
];

export const CENTURIES = [
  [15, 'Jeanne d’Arc (morte en 1431), fin de la guerre de Cent Ans (1453)'],
  [16, 'Renaissance · ordonnance de Villers-Cotterêts (1539)'],
  [17, 'Règne de Louis XIV · château de Versailles'],
  [18, 'Siècle des Lumières · Révolution française (1789)'],
  [19, 'Abolition de l’esclavage (1848) · IIIe République (1870)'],
  [20, 'Guerres mondiales · droit de vote des femmes (1944) · Ve République (1958)'],
  [21, 'Depuis 2001'],
];

// Années couvertes par un siècle : le XVe siècle va de 1401 à 1500.
export const centuryYears = (n) => [(n - 1) * 100 + 1, n * 100];
