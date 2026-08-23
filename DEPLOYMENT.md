# Production Deployment

The supplied Compose file is suitable for local and trusted-network deployments. Before exposing
the server across networks, place an HTTPS reverse proxy in front of port 4000.

For a hostname such as `screens.example.com`:

1. Point DNS to the reverse-proxy host.
2. Obtain and automatically renew a trusted TLS certificate.
3. Proxy HTTPS requests and WebSocket upgrades to `server:4000`.
4. Set `PUBLIC_BASE_URL=https://screens.example.com`.
5. Set `ADMIN_ALLOWED_ORIGINS=https://screens.example.com`.
6. Expose only ports 80 and 443 publicly. Do not expose MySQL port 3306.

A minimal Caddy site block on the same Docker network is:

```text
screens.example.com {
  reverse_proxy server:4000
}
```

Use deployment-specific secrets rather than the development defaults. Back up both named volumes,
verify checksums, and practice restoration before an upgrade. Pull explicit release tags rather
than `latest`, inspect release notes, back up, then recreate the service. The API applies ordered
database migrations before accepting traffic and refuses to start if an applied migration's
checksum changed.

Live web links are rendered in a sandboxed iframe on each client. A destination may still refuse to
render through `X-Frame-Options` or Content Security Policy; verify each URL on a test display.
