module.exports = (user, authCode) => {
  const mjmlOutput = `<mjml>
  <mj-head>
    <mj-title>Say hello to card</mj-title>
    <mj-font name="Lato" href="https://fonts.googleapis.com/css?family=Lato:300,400,500,700"></mj-font>
    <mj-attributes>
      <mj-all font-family="Lato, Helvetica, Arial, sans-serif"></mj-all>
      <mj-text font-weight="400" font-size="16px" color="#000000" line-height="24px"></mj-text>
      <mj-section padding="0px"></mj-section>
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#F2F2F2">
    <mj-section padding="10px 0 20px 0">
      <mj-column>
        <mj-text align="center" color="#25233D" font-size="11px">Papeo Verifizierungscode</mj-text>
      </mj-column>
    </mj-section>
    <mj-section padding="20px 20px 0 20px" background-color="#FFFFFF">
      <mj-column>
        <mj-image height="100px" width= "100px" src="https://i.ibb.co/DW4Y8HF/App-Icon-Android400.png" href="https://papeo.party/"></mj-image>
      </mj-column>
      <mj-column width="65%">
      </mj-column>
    </mj-section>
    <mj-section padding="20px 20px 0 20px" background-color="#FFFFFF">
      <mj-column>
        <mj-text align="center" font-weight="500" padding="0px 40px 10px 40px" font-size="32px" line-height="40px" color="#25233D">Papeo Verifizierungscode</mj-text>
      </mj-column>
    </mj-section>
    <mj-section padding="10px 20px" background-color="#FFFFFF">
      <mj-column>
        <mj-divider width="30px" border-width="3px" border-color="#9B9B9B"></mj-divider>
      </mj-column>
    </mj-section>
    <mj-section padding="0 20px 20px 20px" background-color="#FFFFFF">
      <mj-column width="80%">
        <mj-text align="center" padding-top="10px" font-weight="500" padding="0px">
          Hallo ${user.firstName || "Papeo-Nutzer"},
        </mj-text>
        <mj-text align="center" padding-top="5px" font-weight="500" padding="0px">
          bitte verwende den folgenden Code, um die Prüfung abzuschließen:
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#25233D">
      <mj-column width="100%">
        <mj-image src="http://nimus.de/share/tpl-card/lineshadow.png" alt="" align="center" border="none" padding="0px"></mj-image>
        <mj-text color="#fff" align="center" padding="20px 40px 0 40px" font-weight="1000">
          ${authCode}
        </mj-text>
        <mj-text color="#fff" align="center" padding="20px 40px 0 40px" font-weight="500" padding-bottom="100px" padding-top="20px">Dieser Code läuft in 15 Minuten ab. Wenn du nicht um einen Verifizierungscode gebeten hast oder auf der Webseite zu einem aufgefordert worden bist, ändere dein Passwort sofort.</mj-text>
      </mj-column>
    </mj-section>
    <mj-section padding="50px 0 0 0" background-color="#FFFFFF">
      <mj-column>
        <mj-image src="http://nimus.de/share/tpl-card/bottom.png" alt="bottom border" align="center" border="none" padding="0px"></mj-image>
      </mj-column>
    </mj-section>
    <mj-section padding="10px 0 20px 0">
      <mj-column>
        <mj-text align="center" color="#9B9B9B" font-size="11px"><a href="https://papeo.party/" style="color: #9B9B9B; text-decoration:none;">Papeo UG (haftungsbeschränkt)</a><br/>Hafenstr. 12 / 04416 Markkleeberg / Deutschland </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;
  return mjmlOutput;
};
