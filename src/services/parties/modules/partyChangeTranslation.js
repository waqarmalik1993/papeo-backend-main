const PARTYCHANGE_LANG = {
  nameUpdatedDate: {
    de: "Name",
    fr: "Nom",
    it: "Nome",
    es: "Nombre",
    en: "Name",
  },
  descriptionUpdatedDate: {
    de: "Beschreibung",
    fr: "Description",
    it: "Descrizione",
    es: "Descripción",
    en: "Description",
  },
  addressUpdatedDate: {
    de: "Adresse",
    fr: "Adresse",
    it: "Indirizzo",
    es: "Dirección",
    en: "Address",
  },
  entranceFeeUpdatedDate: {
    de: "Eintritt",
    fr: "Entrée",
    it: "Ammissione",
    es: "Admisión",
    en: "Admission",
  },
  capacityUpdatedDate: {
    de: "Anzahl der Gäste",
    fr: "Nombre d'invités",
    it: "Numero di ospiti",
    es: "Número de invitados",
    en: "Number of guests",
  },
  informationForAcceptedGuestsUpdatedDate: {
    de: "Allgemeine Informationen",
    fr: "Informations générales",
    it: "Informazioni generali",
    es: "Información general",
    en: "General information",
  },
  startDateUpdatedDate: {
    de: "Start der Veranstaltung",
    fr: "Début de l'événement",
    it: "Inizio dell'evento",
    es: "Inicio del evento",
    en: "Start of the event",
  },
  endDateUpdatedDate: {
    de: "Ende der Veranstaltung",
    fr: "Fin de l'événement",
    it: "Fine dell'evento",
    es: "Fin del evento",
    en: "End of the event",
  },
};
exports.PARTYCHANGE_LANG = PARTYCHANGE_LANG;

exports.text = (textTemplate, language) => {
  let text = textTemplate.de;
  if (textTemplate[language]) text = textTemplate[language];
  return text;
};
