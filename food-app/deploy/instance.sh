# Which copy of the ordering system a script works on. Sourced by the other deploy scripts; not run on its own.
#
# The company copy is "food-app", as it always was. A second copy, such as a temporary demo on another address, has
# its own name and with it its own code folder, database, settings file, service, port, web files and nginx file, so
# the two never share data. Nothing here is shared between copies except the Linux account (foodapp), PostgreSQL itself,
# nginx and the Flutter SDK.
#
# The name comes from INSTANCE when it is set; otherwise from where the calling script lives (/srv/<name>/repo/...),
# so "bash /srv/food-demo/repo/food-app/deploy/update.sh" works on the demo without anything else; otherwise food-app.
if [ -z "${INSTANCE:-}" ]; then
  _caller_dir="$(cd "$(dirname "${BASH_SOURCE[1]:-$0}")" 2>/dev/null && pwd || true)"
  case "$_caller_dir" in
    /srv/*/repo/food-app/deploy) INSTANCE="$(echo "$_caller_dir" | cut -d/ -f3)" ;;
    *) INSTANCE=food-app ;;
  esac
  unset _caller_dir
fi
if ! [[ "$INSTANCE" =~ ^[a-z][a-z0-9-]{1,30}$ ]]; then
  echo "INSTANCE must be a short name in lower-case letters, digits and dashes, like food-demo." >&2
  exit 1
fi
export INSTANCE

ROOT="/srv/$INSTANCE"
REPO="$ROOT/repo"
DATA="/var/lib/$INSTANCE"
WWW="/var/www/$INSTANCE"
ENV_FILE="${ENV_FILE:-/etc/$INSTANCE.env}"
SERVICE="$INSTANCE"
NGINX_CONF="/etc/nginx/conf.d/$INSTANCE.conf"
# For names inside nginx and PostgreSQL, which do not take dashes.
INSTANCE_ID="${INSTANCE//-/_}"

if [ "$INSTANCE" = food-app ]; then
  # The company copy keeps the names it was set up with.
  DB_NAME=food_app
  DB_ROLE=foodapp
  DEFAULT_PORT=3100
else
  DB_NAME="$INSTANCE_ID"
  DB_ROLE="$INSTANCE_ID"
  DEFAULT_PORT=3200
fi

# The port the service listens on (only nginx reaches it): PORT when given, else the LISTEN_PORT line setup.sh wrote
# into this copy's settings file, else the default above.
_port_in_file=""
if [ -r "$ENV_FILE" ]; then
  _port_in_file="$(sed -n 's/^[[:space:]]*\(export \)\{0,1\}LISTEN_PORT=["'\'']\{0,1\}\([0-9][0-9]*\).*/\2/p' "$ENV_FILE" | tail -1)"
fi
PORT="${PORT:-${_port_in_file:-$DEFAULT_PORT}}"
unset _port_in_file
if ! [[ "$PORT" =~ ^[0-9]{4,5}$ ]]; then
  echo "PORT must be a number like 3200." >&2
  exit 1
fi

# Fills in a deploy template (the nginx files, the service file) for this copy and prints the result.
render_template() {
  sed -e "s|__DOMAIN__|${DOMAIN:-}|g" -e "s|__WWW__|$WWW|g" -e "s|__PORT__|$PORT|g" -e "s|__ID__|$INSTANCE_ID|g" \
      -e "s|__INSTANCE__|$INSTANCE|g" -e "s|__ENV_FILE__|$ENV_FILE|g" -e '/^# A template:/d' "$1"
}
