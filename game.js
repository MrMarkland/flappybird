/* ============================
   GOOGLE DRIVE UPLOADER (NEW)
============================ */

const DriveUploader = {
  clientId: "YOUR_GOOGLE_CLIENT_ID",
  apiKey: "YOUR_GOOGLE_API_KEY",
  scope: "https://www.googleapis.com/auth/drive.file",
  tokenClient: null,
  accessToken: null,

  init() {
    gapi.load("client", async () => {
      await gapi.client.init({
        apiKey: this.apiKey,
        discoveryDocs: [
          "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"
        ]
      });
    });

    this.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: this.clientId,
      scope: this.scope,
      callback: (tokenResponse) => {
        this.accessToken = tokenResponse.access_token;
        this.uploadSession();
      }
    });
  },

  saveToDrive() {
    if (!this.accessToken) {
      this.tokenClient.requestAccessToken();
    } else {
      this.uploadSession();
    }
  },

  async uploadSession() {
    const metadata = {
      name: `floppybird_session_${Telemetry.sessionId}.json`,
      mimeType: "application/json"
    };

    const file = new Blob(
      [JSON.stringify(Telemetry.buffer, null, 2)],
      { type: "application/json" }
    );

    const form = new FormData();
    form.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], { type: "application/json" })
    );
    form.append("file", file);

    await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`
        },
        body: form
      }
    );

    alert("Session saved to Google Drive");
  }
};

/* Initialize Drive module */
window.addEventListener("load", () => DriveUploader.init());
