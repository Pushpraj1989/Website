# Content manager: who can get in and how

The CMS is Decap CMS (MIT). It edits the JSON files in `content/` and saves them to the GitHub
repo. Nothing is stored on a database, so there is no separate password store to leak.

## How an editor signs in

1. The site owner invites the editor as a **collaborator with Write access** to the repo
   (GitHub → Settings → Collaborators). Without that, GitHub refuses the save, even after sign-in.
2. The editor opens `https://<portal>/admin/`.
3. The nginx layer asks for the **CMS password** (one htpasswd user per editor, see below).
4. The editor clicks **Login with GitHub**. The popup goes to the auth proxy (`auth/server.mjs`),
   then to GitHub, and returns a token that only that editor has.
5. Saving a change commits it to the repo as that editor, so the git history shows who changed what.

Two layers guard the CMS: the nginx password, and GitHub write access. Someone who knows the
password but has no GitHub write access can open the page but cannot save anything.

## Setup, once

| Step | What | Where |
| --- | --- | --- |
| 1 | Create a GitHub OAuth App. Homepage: the portal URL. Callback URL: `https://<auth-host>/callback` | GitHub → Developer settings → OAuth Apps |
| 2 | Run the auth proxy with `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `PUBLIC_URL=https://<auth-host>`, `SITE_ORIGIN=https://<portal-host>` | a small Node 18+ host, or a serverless function. Keep the secret in the host's secret store |
| 3 | Set `backend.base_url` in `admin/config.yml` to `https://<auth-host>` and `backend.repo` / `branch` | `admin/config.yml` (public, contains no secret) |
| 4 | Create the htpasswd file: `htpasswd -c /etc/nginx/azaiba-cms.htpasswd <editor>` (add more users with `-b`, no `-c`) | server |
| 5 | Put `deploy/nginx.conf` in place, fill in the TODO lines, `nginx -t`, reload | server |
| 6 | Turn on two-factor authentication for every editor's GitHub account, and use an organisation if you can | GitHub settings |

## Adding or removing an editor

- **Add:** invite them as a collaborator (Write), and add an htpasswd user.
- **Remove:** remove the collaborator, and delete the htpasswd line with `htpasswd -D <file> <editor>`.
  Their saved tokens stop working once the collaborator is removed.
- **Rotate the OAuth secret:** regenerate it in GitHub, update the proxy's environment, restart it.

## What each part protects

| Risk | Control |
| --- | --- |
| Someone guesses the admin URL | the nginx password, `noindex` header, `Disallow: /admin/` in robots.txt |
| Someone with the password, but no GitHub access, tries to save | GitHub refuses: no write access to the repo |
| Token theft from the page | the token is sent only to the portal origin (`SITE_ORIGIN`); the admin CSP blocks other script sources |
| CSRF on the sign-in | a random `state` per sign-in, checked against an HttpOnly cookie |
| Secret leaked in the repo | the client secret lives only in the proxy's environment; `.gitignore` the `.env` file |
| Accidental publication of source or config | nginx returns 404 for `.md`, `.mjs`, `.map`; the build output is `dist/` only |

## Publishing a change

A CMS save commits the JSON. The public site changes only after the build runs:

```
cd portals/azaiba-portal
python3 build.py        # writes dist/ and the React app into dist/app/
```

Deploy `dist/` to the server (`rsync -a dist/ /srv/azaiba-portal/dist/`). Automating this step on
every commit is the next thing to add (see the README).

## Recovery

Every change is a git commit. To undo a bad edit, revert the commit, rebuild and deploy.
