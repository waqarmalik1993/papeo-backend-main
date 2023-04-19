//I18N
exports.Transactions = {
  boughtPartyPoints: (transaction) => {
    return {
      en: `Bougth ${transaction.amount} Party Points`,
      de: `${transaction.amount} Party Points gekauft`,
      fr: `${transaction.amount} Party Points achetés`,
      it: `Comprato ${transaction.amount} Punti Partito`,
      es: `Comprado ${transaction.amount} Party Points`,
    };
  },
  invitedPeopleToParty: (transaction) => {
    return {
      en: `Invited ${transaction.data.peopleCount} guests to ${transaction.data.partyName}`,
      de: `${transaction.data.peopleCount} Gäste zu ${transaction.data.partyName} eingeladen`,
      fr: `${transaction.data.peopleCount} personnes invitées à ${transaction.data.partyName}`,
      it: `${transaction.data.peopleCount} ospiti invitati al ${transaction.data.partyName}`,
      es: `${transaction.data.peopleCount} invitados a la ${transaction.data.partyName}`,
    };
  },
  createdAdditionalParty: (transaction) => {
    return {
      en: `Created an additional party: ${transaction.data.partyName}`,
      de: `Zusätzliche Party erstellt: ${transaction.data.partyName}`,
      fr: `Fête supplémentaire créée : ${transaction.data.partyName}`,
      it: `Festa supplementare creata: ${transaction.data.partyName}`,
      es: `Se ha creado un partido adicional: ${transaction.data.partyName}`,
    };
  },
  broadCastedMessage: (transaction) => {
    return {
      en: `Send a message to ${transaction.data.peopleCount} guests in ${transaction.data.partyName}`,
      de: `Nachricht an ${transaction.data.peopleCount} Gäste gesendet in ${transaction.data.partyName}`,
      fr: `Message envoyé à ${transaction.data.peopleCount} invités dans ${transaction.data.partyName}`,
      it: `Messaggio inviato a ${transaction.data.peopleCount} ospiti in ${transaction.data.partyName}`,
      es: `Mensaje enviado a ${transaction.data.peopleCount} invitados en ${transaction.data.partyName}`,
    };
  },
  adminDebit: (transaction) => {
    return {
      en: `Debited Party Points from admin, reason: ${
        transaction.data.reason || ""
      }`,
      de: `Party Points abgezogen durch Administrator, Grund: ${
        transaction.data.reason || ""
      }`,
      fr: `Points de fête déduits par l'administrateur, raison : ${
        transaction.data.reason || ""
      }`,
      it: `Partito Punti dedotti dall'amministratore, Motivo: ${
        transaction.data.reason || ""
      }`,
      es: `Partido Puntos deducidos por el Administrador, Razón: ${
        transaction.data.reason || ""
      }`,
    };
  },
  adminCredit: (transaction) => {
    return {
      en: `Credited Party Points from admin, reason: ${
        transaction.data.reason || ""
      }`,
      de: `Party Points hinzugefügt durch Administrator, Grund: ${
        transaction.data.reason || ""
      }`,
      fr: `Points de fête ajoutés par l'administrateur, raison : ${
        transaction.data.reason || ""
      }`,
      it: `Party Points aggiunto da Administrator, Motivo: ${
        transaction.data.reason || ""
      }`,
      es: `Puntos de partido añadidos por el Administrador, Razón: ${
        transaction.data.reason || ""
      }`,
    };
  },
  referredUserCredit: (transaction) => {
    if (!transaction.data) {
      return {
        en: "You have referred a user",
        de: "Du hast einen Nutzer geworben",
        fr: "Tu as parrainé un utilisateur",
        it: "Hai reclutato un utente",
        es: "Has reclutado a un usuario",
      };
    }
    return {
      en: `You have referred a user: ${transaction.data.referredUserName}`,
      de: `Du hast einen Nutzer geworben: ${transaction.data.referredUserName}`,
      fr: `Tu as parrainé un utilisateur: ${transaction.data.referredUserName}`,
      it: `Hai reclutato un utente: ${transaction.data.referredUserName}`,
      es: `Has reclutado a un usuario: ${transaction.data.referredUserName}`,
    };
  },
  referredUserCreditMLM: (transaction) => {
    if (!transaction.data) {
      return {
        en: "You have referred a user",
        de: "Du hast einen Nutzer geworben",
        fr: "Tu as parrainé un utilisateur",
        it: "Hai reclutato un utente",
        es: "Has reclutado a un usuario",
      };
    }
    return {
      en: `Level ${transaction.data.level} registration completed`,
      de: `Stufe ${transaction.data.level} Registrierung abgeschlossen`,
      fr: `Niveau ${transaction.data.level} Enregistrement terminé`,
      it: `Livello ${transaction.data.level} Registrazione completata`,
      es: `Nivel ${transaction.data.level} Registro completado`,
    };
  },
  referredUserDebitMLM: (transaction) => {
    if (!transaction.data) {
      return {
        en: "You have referred a user",
        de: "Du hast einen Nutzer geworben",
        fr: "Tu as parrainé un utilisateur",
        it: "Hai reclutato un utente",
        es: "Has reclutado a un usuario",
      };
    }
    return {
      en: `Level ${transaction.data.level} registration completed`,
      de: `Stufe ${transaction.data.level} Registrierung abgeschlossen`,
      fr: `Niveau ${transaction.data.level} Enregistrement terminé`,
      it: `Livello ${transaction.data.level} Registrazione completata`,
      es: `Nivel ${transaction.data.level} Registro completado`,
    };
  },
  referredByAUserCredit: (transaction) => {
    return {
      en: "You have been referred by a user",
      de: "Du wurdest von einem Nutzer geworben",
      fr: "Tu as été parrainé par un utilisateur",
      it: "Sei stato segnalato da un utente",
      es: "Usted ha sido referido por un usuario",
    };
  },
  payoutRequested: (transaction) => {
    return {
      en: "Payout requested",
      de: "Auszahlung angefragt",
      fr: "Paiement demandé",
      it: "Pagamento richiesto",
      es: "Pago solicitado",
    };
  },
  payoutRejected: (transaction) => {
    return {
      en: "Payout refused",
      de: "Auszahlung abgelehnt",
      fr: "Paiement refusé",
      it: "Pagamento rifiutato",
      es: "Pago rechazado",
    };
  },
  menuCardPayment: (transaction) => {
    return {
      en: "Order placed",
      de: "Bestellung aufgegeben",
      fr: "Commande passée",
      it: "Ordine effettuato",
      es: "Pedido realizado",
    };
  },
  menuCardPaymentCredit: (transaction) => {
    return {
      en: "Order received",
      de: "Bestellung erhalten",
      fr: "Commande reçue",
      it: "Ordine ricevuto",
      es: "Pedido recibido",
    };
  },
};
