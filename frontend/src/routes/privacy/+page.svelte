<script lang="ts">
	import { t, lang } from '$lib/i18n';
</script>

<svelte:head>
	<title>{$t.nav.privacy} — Chess</title>
	<meta name="description" content="Privacy Policy — Chess online chess platform." />
</svelte:head>

<div class="legal-page">
	<div class="legal-card">

<!-- ══════════════════════════════════════ ITALIANO ══════════════════════════════════════ -->
{#if $lang === 'it'}

	<h1>Privacy Policy</h1>
	<p class="updated">Ultimo aggiornamento: maggio 2026</p>

	<section>
		<h2>1. Titolare del trattamento</h2>
		<p>Il titolare del trattamento è il gestore del sito Chess, contattabile a:
		<a href="mailto:salsx@hotmail.it">salsx@hotmail.it</a>.</p>
	</section>

	<section>
		<h2>2. Dati raccolti</h2>
		<ul>
			<li><strong>Registrazione</strong>: username, e-mail, password (hashed).</li>
			<li><strong>Gioco</strong>: partite, mosse, risultati, rating ELO.</li>
			<li><strong>Tecnici</strong>: IP, browser, OS (log standard del server).</li>
			<li><strong>Cookie</strong>: vedi sezione 4.</li>
		</ul>
	</section>

	<section>
		<h2>3. Finalità del trattamento</h2>
		<ul>
			<li>Erogare e migliorare il servizio (base: esecuzione del contratto).</li>
			<li>Sicurezza e prevenzione abusi (base: legittimo interesse).</li>
			<li>Pubblicità contestuale tramite Google AdSense (base: consenso).</li>
		</ul>
	</section>

	<section>
		<h2>4. Cookie</h2>
		<h3>Cookie tecnici / essenziali</h3>
		<p>Necessari al funzionamento — non richiedono consenso.
		Includono il token di autenticazione (<code>auth_token</code>) e la preferenza di lingua (<code>lang</code>).</p>

		<h3>Cookie pubblicitari (solo con consenso)</h3>
		<p>Con il tuo consenso carichiamo lo script di <strong>Google AdSense</strong>
		(<code>pagead2.googlesyndication.com</code>), che imposta cookie propri per annunci personalizzati.
		Puoi gestire le preferenze su
		<a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer">adssettings.google.com</a>.</p>

		<h3>Gestione del consenso</h3>
		<p>La tua scelta è salvata in <code>localStorage.cookie_consent</code>.
		Puoi revocarla svuotando i dati del sito nelle impostazioni del browser.</p>
	</section>

	<section>
		<h2>5. Terze parti</h2>
		<ul>
			<li><strong>Google AdSense / Google LLC</strong> —
			<a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Privacy policy Google</a>.</li>
			<li><strong>Provider di hosting</strong> — registra log di accesso standard.</li>
		</ul>
	</section>

	<section>
		<h2>6. Conservazione</h2>
		<p>I dati di account sono conservati fino alla cancellazione del profilo.
		I log del server vengono eliminati entro 30 giorni.</p>
	</section>

	<section>
		<h2>7. Diritti dell'utente (GDPR)</h2>
		<p>Hai diritto di accesso, rettifica, cancellazione, limitazione, portabilità e opposizione.
		Puoi revocare il consenso in qualsiasi momento.
		Per esercitare i tuoi diritti scrivi a <a href="mailto:salsx@hotmail.it">salsx@hotmail.it</a>
		oppure presenta reclamo al
		<a href="https://www.garanteprivacy.it" target="_blank" rel="noopener noreferrer">Garante Privacy</a>.</p>
	</section>

	<section>
		<h2>8. Modifiche</h2>
		<p>Ci riserviamo di aggiornare questa informativa in caso di variazioni del servizio o della normativa.
		La data in cima indica l'ultima revisione.</p>
	</section>

<!-- ══════════════════════════════════════ ENGLISH ══════════════════════════════════════ -->
{:else if $lang === 'en'}

	<h1>Privacy Policy</h1>
	<p class="updated">Last updated: May 2026</p>

	<section>
		<h2>1. Data Controller</h2>
		<p>The data controller is the operator of the Chess platform, reachable at:
		<a href="mailto:salsx@hotmail.it">salsx@hotmail.it</a>.</p>
	</section>

	<section>
		<h2>2. Data Collected</h2>
		<ul>
			<li><strong>Registration</strong>: username, e-mail, password (hashed).</li>
			<li><strong>Gameplay</strong>: games played, moves, results, ELO rating.</li>
			<li><strong>Technical</strong>: IP address, browser, OS (standard server logs).</li>
			<li><strong>Cookies</strong>: see section 4.</li>
		</ul>
	</section>

	<section>
		<h2>3. Purposes of Processing</h2>
		<ul>
			<li>Provide and improve the service (legal basis: performance of contract).</li>
			<li>Security and abuse prevention (legal basis: legitimate interest).</li>
			<li>Contextual advertising via Google AdSense (legal basis: consent).</li>
		</ul>
	</section>

	<section>
		<h2>4. Cookies</h2>
		<h3>Essential / Technical Cookies</h3>
		<p>Required for the service to function — no consent needed.
		Includes the authentication token (<code>auth_token</code>) and language preference (<code>lang</code>).</p>

		<h3>Advertising Cookies (consent required)</h3>
		<p>With your consent we load the <strong>Google AdSense</strong> script
		(<code>pagead2.googlesyndication.com</code>), which sets its own cookies for personalised ads.
		Manage your ad preferences at
		<a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer">adssettings.google.com</a>.</p>

		<h3>Managing Consent</h3>
		<p>Your choice is stored in <code>localStorage.cookie_consent</code>.
		You can withdraw it at any time by clearing site data in your browser settings.</p>
	</section>

	<section>
		<h2>5. Third Parties</h2>
		<ul>
			<li><strong>Google AdSense / Google LLC</strong> —
			<a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a>.</li>
			<li><strong>Hosting provider</strong> — may store standard access logs.</li>
		</ul>
	</section>

	<section>
		<h2>6. Data Retention</h2>
		<p>Account data is kept until you delete your profile.
		Server logs are deleted within 30 days.</p>
	</section>

	<section>
		<h2>7. Your Rights (GDPR)</h2>
		<p>You have the right to access, rectify, erase, restrict, port, and object to your data.
		You may withdraw consent at any time.
		To exercise your rights contact <a href="mailto:salsx@hotmail.it">salsx@hotmail.it</a>
		or lodge a complaint with your local supervisory authority.</p>
	</section>

	<section>
		<h2>8. Changes</h2>
		<p>We may update this policy to reflect changes to the service or applicable law.
		The date at the top always shows the latest revision.</p>
	</section>

<!-- ══════════════════════════════════════ ESPAÑOL ══════════════════════════════════════ -->
{:else}

	<h1>Política de privacidad</h1>
	<p class="updated">Última actualización: mayo de 2026</p>

	<section>
		<h2>1. Responsable del tratamiento</h2>
		<p>El responsable del tratamiento es el operador de la plataforma Chess, contactable en:
		<a href="mailto:salsx@hotmail.it">salsx@hotmail.it</a>.</p>
	</section>

	<section>
		<h2>2. Datos recopilados</h2>
		<ul>
			<li><strong>Registro</strong>: nombre de usuario, correo electrónico, contraseña (cifrada).</li>
			<li><strong>Juego</strong>: partidas jugadas, movimientos, resultados, ELO.</li>
			<li><strong>Técnicos</strong>: dirección IP, navegador, SO (registros estándar del servidor).</li>
			<li><strong>Cookies</strong>: ver sección 4.</li>
		</ul>
	</section>

	<section>
		<h2>3. Finalidades del tratamiento</h2>
		<ul>
			<li>Prestar y mejorar el servicio (base: ejecución del contrato).</li>
			<li>Seguridad y prevención de abusos (base: interés legítimo).</li>
			<li>Publicidad contextual mediante Google AdSense (base: consentimiento).</li>
		</ul>
	</section>

	<section>
		<h2>4. Cookies</h2>
		<h3>Cookies técnicas / esenciales</h3>
		<p>Necesarias para el funcionamiento del servicio — no requieren consentimiento.
		Incluyen el token de autenticación (<code>auth_token</code>) y la preferencia de idioma (<code>lang</code>).</p>

		<h3>Cookies publicitarias (requieren consentimiento)</h3>
		<p>Con tu consentimiento cargamos el script de <strong>Google AdSense</strong>
		(<code>pagead2.googlesyndication.com</code>), que establece sus propias cookies para anuncios personalizados.
		Puedes gestionar tus preferencias en
		<a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer">adssettings.google.com</a>.</p>

		<h3>Gestión del consentimiento</h3>
		<p>Tu elección se guarda en <code>localStorage.cookie_consent</code>.
		Puedes retirarla en cualquier momento borrando los datos del sitio en la configuración del navegador.</p>
	</section>

	<section>
		<h2>5. Terceros</h2>
		<ul>
			<li><strong>Google AdSense / Google LLC</strong> —
			<a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Política de privacidad de Google</a>.</li>
			<li><strong>Proveedor de hosting</strong> — puede almacenar registros de acceso estándar.</li>
		</ul>
	</section>

	<section>
		<h2>6. Conservación de datos</h2>
		<p>Los datos de cuenta se conservan hasta que elimines tu perfil.
		Los registros del servidor se eliminan en un plazo de 30 días.</p>
	</section>

	<section>
		<h2>7. Tus derechos (RGPD)</h2>
		<p>Tienes derecho de acceso, rectificación, supresión, limitación, portabilidad y oposición.
		Puedes retirar el consentimiento en cualquier momento.
		Para ejercer tus derechos escribe a <a href="mailto:salsx@hotmail.it">salsx@hotmail.it</a>
		o presenta una reclamación ante tu autoridad de control local.</p>
	</section>

	<section>
		<h2>8. Cambios</h2>
		<p>Podemos actualizar esta política para reflejar cambios en el servicio o en la normativa aplicable.
		La fecha indicada al principio muestra la última revisión.</p>
	</section>

{/if}

	</div>
</div>

<style>
	.legal-page {
		max-width: 720px;
		margin: 0 auto;
		padding: 1.5rem 1.5rem 1.5rem;
		height: 100%;
		overflow-y: auto;
	}

	.legal-card {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 2.5rem 2rem;
		display: flex;
		flex-direction: column;
		gap: 1.75rem;
	}

	h1 {
		font-size: 1.75rem;
		font-weight: 800;
		color: var(--text);
		margin: 0;
	}

	.updated {
		font-size: 0.82rem;
		color: var(--text-muted);
		margin: -1rem 0 0;
	}

	section {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	h2 {
		font-size: 1rem;
		font-weight: 700;
		color: var(--accent);
		border-bottom: 1px solid var(--border);
		padding-bottom: 0.3rem;
		margin: 0;
	}

	h3 {
		font-size: 0.92rem;
		font-weight: 600;
		color: var(--text);
		margin: 0.5rem 0 0;
	}

	p {
		font-size: 0.9rem;
		color: var(--text-muted);
		line-height: 1.7;
		margin: 0;
	}

	ul {
		padding-left: 1.4rem;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	li {
		font-size: 0.9rem;
		color: var(--text-muted);
		line-height: 1.7;
	}

	strong { color: var(--text); }
	a { color: var(--accent); }
	a:hover { text-decoration: underline; }

	code {
		font-size: 0.82rem;
		background: var(--bg-input);
		border-radius: 3px;
		padding: 0.1em 0.35em;
		color: var(--text);
	}

	@media (max-width: 768px) {
		.legal-card { padding: 1.5rem 1rem; }
		h1 { font-size: 1.4rem; }
	}
</style>
