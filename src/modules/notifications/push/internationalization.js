module.exports = {
  PUSH_PARTY_RATING: (party, lang = "de") => {
    const msg = {
      title: {
        de: "Papeo",
        it: "Papeo",
        en: "Papeo",
        es: "Papeo",
        fr: "Papeo",
      },
      body: {
        de: `Wie war die Party "${party.name}"?`,
        it: `Com'era la festa "${party.name}"?`,
        en: `How was the party "${party.name}"?`,
        es: `¿Cómo fue la fiesta "${party.name}"?`,
        fr: `Comment s'est passée la fête "${party.name}" ?`,
      },
    };
    return {
      title: msg.title[lang],
      body: msg.body[lang],
    };
  },
  PUSH_ONSITE_CHECK: (party, lang = "de") => {
    const msg = {
      title: {
        de: "Papeo",
        it: "Papeo",
        en: "Papeo",
        es: "Papeo",
        fr: "Papeo",
      },
      body: {
        de: `Bist du auf der Party "${party.name}"?`,
        it: `Sei alla festa "${party.name}"?`,
        fr: `Tu es à la fête "${party.name}" ?`,
        es: `¿Estás en la fiesta "${party.name}"?`,
        en: `Are you at the party "${party.name}"?`,
      },
    };
    return {
      title: msg.title[lang],
      body: msg.body[lang],
    };
  },
  PUSH_BOUGHT_PP: (amount, lang = "de") => {
    const msg = {
      title: {
        de: "Papeo",
        it: "Papeo",
        en: "Papeo",
        es: "Papeo",
        fr: "Papeo",
      },
      body: {
        de: `Erfolgreich ${amount} Party Points aufgeladen`,
        it: `${amount} Punti Partito sono stati accreditati con successo`,
        fr: `${amount} Party Points ont été crédités avec succès`,
        es: `Se han acreditado con éxito ${amount} puntos de partido`,
        en: `${amount} Party Points were successfully credited`,
      },
    };
    return {
      title: msg.title[lang],
      body: msg.body[lang],
    };
  },
  PUSH_PARTY_REMINDER: (party, lang = "de") => {
    const msg = {
      title: {
        de: "Papeo",
        it: "Papeo",
        en: "Papeo",
        es: "Papeo",
        fr: "Papeo",
      },
      body: {
        de: `Erinnerung: "${party.name}" findet Morgen statt`,
        it: `Promemoria: "${party.name}" si svolge domani`,
        en: `Reminder: "${party.name}" will take place tomorrow`,
        es: `Recordatorio: "${party.name}" tiene lugar mañana`,
        fr: `Rappel : "${party.name}" a lieu demain`,
      },
    };
    return {
      title: msg.title[lang],
      body: msg.body[lang],
    };
  },
  ADMIN_USER_LOGIN: (adminUsername, userUsername, lang = "de") => {
    const msg = {
      title: {
        de: "Papeo",
        it: "Papeo",
        en: "Papeo",
        es: "Papeo",
        fr: "Papeo",
      },
      body: {
        de: `${adminUsername} (Admin) hat sich in das Profil von ${userUsername} eingeloggt.`,
        it: `${adminUsername} (Admin) ha effettuato l'accesso al profilo di ${userUsername}.`,
        en: `${adminUsername} (Admin) has logged in to ${userUsername}'s profile.`,
        es: `${adminUsername} (Admin) ha entrado en el perfil de ${userUsername}.`,
        fr: `${adminUsername} (Admin) hat sich in das Profil von ${userUsername} eingeloggt.`,
      },
    };
    return {
      title: msg.title[lang],
      body: msg.body[lang],
    };
  },
  PUSH_MLM_REFERRED_USER: (level, lang = "de") => {
    const msg = {
      title: {
        de: "Papeo",
        it: "Papeo",
        en: "Papeo",
        es: "Papeo",
        fr: "Papeo",
      },
      body: {
        en: `Level ${level} registration completed`,
        de: `Level ${level} Registrierung abgeschlossen`,
        fr: `Inscription de niveau ${level} terminée`,
        it: `Completata la registrazione al livello ${level}`,
        es: `Registro de nivel ${level} completado`,
      },
    };
    return {
      title: msg.title[lang],
      body: msg.body[lang],
    };
  },
  PUSH_PAYOUT_PAID: (lang = "de") => {
    const msg = {
      title: {
        de: "🤑 Papeo Auszahlungen",
        it: "🤑 Papeo Esborsi",
        en: "🤑 Papeo Payments",
        es: "🤑 Papeo Desembolsos",
        fr: "🤑 Papeo Décaissements",
      },
      body: {
        en: "Your payout is on its way. Please check your account.",
        de: "Deine Auszahlung ist unterwegs. Bitte überprüfe dein Konto.",
        fr: "Ton paiement est en cours. Veuillez vérifier votre compte.",
        it: "La vostra vincita è in arrivo. Si prega di controllare il proprio account.",
        es: "Su pago está en camino. Por favor, compruebe su cuenta.",
      },
    };
    return {
      title: msg.title[lang],
      body: msg.body[lang],
    };
  },
  PUSH_PAYOUT_REJECTED: (lang = "de") => {
    const msg = {
      title: {
        de: "🙅 Papeo Auszahlungen",
        it: "🙅 Papeo Esborsi",
        en: "🙅 Papeo Payments",
        es: "🙅 Papeo Desembolsos",
        fr: "🙅 Papeo Décaissements",
      },
      body: {
        en: "Your withdrawal request has been rejected. Please check our terms and conditions or contact our support.",
        de: "Deine Auszahlungsanfrage wurde abgelehnt. Schaue in unsere AGB's oder wende dich an den Support.",
        fr: "Ta demande de retrait a été refusée. Consulte nos conditions générales ou contacte le support.",
        it: "La richiesta di prelievo è stata rifiutata. Verificate i nostri termini e condizioni o contattate l'assistenza.",
        es: "Su solicitud de retirada ha sido rechazada. Consulte nuestras condiciones o póngase en contacto con el servicio de asistencia.",
      },
    };
    return {
      title: msg.title[lang],
      body: msg.body[lang],
    };
  },
};
