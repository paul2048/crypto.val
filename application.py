import sqlite3
import re
import requests

from flask import Flask, render_template, redirect, request, session, jsonify, url_for
from flask_session import Session
from tempfile import mkdtemp
from werkzeug.security import generate_password_hash, check_password_hash
from helpers import lookup, login_required


# Configure the application
app = Flask(__name__)

# Ensure templates are auto-reloaded
app.config["TEMPLATES_AUTO_RELOAD"] = True

# Ensure responses aren't cached
@app.after_request
def after_request(response):
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Expires"]       = 0
    response.headers["Pragma"]        = "no-cache"
    return response

# Configure session to use filesystem (instead of signed cookies)
app.config["SESSION_FILE_DIR"]  = mkdtemp()
app.config["SESSION_PERMANENT"] = False
app.config["SESSION_TYPE"]      = "filesystem"
Session(app)

# SQLite database configuration
conn = sqlite3.connect("crypto_val.db", check_same_thread=False)
c = conn.cursor()


@app.route("/", methods=["GET"])
def index():
    """Renders the tabels of the home page"""
    return render_template("index.html")


@app.route("/coins/<symbol>", methods=["GET", "POST"])
def coins(symbol):
    """Shows stats and details for coins"""
    # If "Add to portfolio" is clicked
    if request.method == "POST":
        return redirect(url_for(".portfolio", symbol=symbol))

    return render_template("coins.html", symbol=symbol)


@app.route("/portfolio", methods=["GET", "POST"])
def portfolio():
    """Adds and subtracts coins from the portfolio"""
    portf_data   = {}

    if not session:
        portf_data = False
    else:
        id_ = session["user_id"]

        c.execute("""SELECT symbol, quantity, total_price
                 FROM transactions
                 WHERE id = ?
                 ORDER BY datetime(timestamp) DESC""",
                 (id_,))

        transactions = c.fetchall()
        # `portf_data[i]` looks like: {'DOGE': [260, 0.728411346]}

        # `tran` looks like: ('ETH', 2, 341.39871345)
        for tran in transactions:
            # If the coin is already in the dictionary, add the quantity and the price
            try:
                portf_data[tran[0]][0] += tran[1]
                portf_data[tran[0]][1] += tran[2]
            # Else, create a new list: [quantity, value]
            except KeyError:
                portf_data[tran[0]] = []
                portf_data[tran[0]].append(tran[1])
                portf_data[tran[0]].append(tran[2])

    # If the portfolio form was submitted
    if request.method == "POST":
        symbol = request.form.get("coin_search_portf").upper()
        resp   = requests.get("https://coinlib.io/api/v1/coin?key=cc1fce0a78dd1a47&symbol=" + symbol)

        # If the user is not logged in or the response failed
        if not session or resp.status_code != 200:
            #### ERROR MESSAGE ####
            return jsonify(False)

        # Convert the response to JSON
        coin       = resp.json()
        quantity   = int(request.form.get("quantity_portf"))
        unit_price = float(coin["price"])

        # If the "add to portfolio" button was pressed
        if "add" in request.form:
            # Inset the transaction in the database
            c.execute("""INSERT INTO transactions
                     (id, symbol, unit_price, quantity, total_price)
                     VALUES (?, ?, ?, ?, ?)""",
                     (id_, symbol, unit_price, quantity, unit_price * quantity))
            conn.commit()
        else:
            # Get the total quantity of the coin from the database
            c.execute("""SELECT SUM(quantity)
                      FROM transactions
                      WHERE id = ? AND symbol = ?""",
                      (id_, symbol))
            db_quantity = c.fetchone()[0]

            # Makes sure the user doesn't remove more than it has
            if db_quantity > quantity:
                c.execute("""INSERT INTO transactions
                         (id, symbol, unit_price, quantity, total_price)
                         VALUES (?, ?, ?, ?, ?)""",
                         (id_, symbol, unit_price, -quantity, -unit_price * quantity))
                conn.commit()
            else:
                #### ERROR MESSAGE ####
                return jsonify(False)

        return redirect(request.path)

    return render_template("portfolio.html", portf_data=portf_data)


@app.route("/news", methods=["GET"])
def news():
    """Gets and appends news"""
    topic   = "cryptocurrency"
    sort_by = "publishedAt"

    if request.args:
        topic   = request.args.get("topic-select")
        sort_by = request.args.get("sortby-select")

    # Get a JSON file from the news API
    news_json = lookup(topic, sort_by)

    # Validate the response
    for article in news_json["articles"]:
        # If the image link is "None", use a default image
        if not article["urlToImage"]:
            article["urlToImage"] = "/static/news_default.png"

    return render_template("news.html", news_json=news_json)


@app.route("/settings", methods=["GET", "POST"])
@login_required
def settings():
    id_ = session["user_id"]

    if request.method == "POST":
        c.execute("SELECT email, hash FROM users WHERE id = ?", (id_,))
        db_email, db_hsh = c.fetchone()
        passw            = request.form.get("curr_pass")

        if not check_password_hash(db_hsh, passw):
            return render_template("error.html", err_message="Wrong current password.")

        if "chg_pass" in request.form:
            new_passw = request.form.get("new_pass")
            new_hsh   = generate_password_hash(new_passw, method='pbkdf2:sha256:100000', salt_length=10)

            # Change the password
            c.execute("UPDATE users SET hash = ? WHERE id = ?",
                     (new_hsh, id_))
            conn.commit()
        elif "chg_email" in request.form:
            email     = request.form.get("curr_email")
            new_email = request.form.get("new_email")

            if email != db_email:
                return render_template("error.html", err_message="Wrong current e-mail.")

            # Change the e-mail
            c.execute("UPDATE users SET email = ? WHERE id = ?",
                     (new_email, id_))
            conn.commit()

        return redirect("/settings")

    return render_template("settings.html")


@app.route("/search")
def search():
    """Return requested coins from database"""
    # Get the query
    q = request.args.get("q")

    # Get the coins that contain the query in the coin name or symbol
    c.execute("SELECT * FROM coins WHERE name LIKE ? OR symbol LIKE ?",
             ("%"+q+"%", "%"+q+"%"))

    matched_coins  = c.fetchall()
    matched_symbol = ""

    if not session:
        return jsonify(False)

    if request.args.get("id") == "coin_search_portf":
        for coin in matched_coins:
            if coin[1] == q:
                matched_symbol = coin[1]

    matched_coins = [{"name": coin[0], "symbol": coin[1]} for coin in matched_coins]

    return jsonify({"coins": matched_coins, "matched_symbol": matched_symbol})


@app.route("/register", methods=["POST"])
def register():
    """Register the user"""
    usern = request.form.get("username")
    passw = request.form.get("password")
    email = request.form.get("email")
    confr = request.form.get("confirmation")

    # Hash the password
    hsh = generate_password_hash(passw, method='pbkdf2:sha256:100000', salt_length=10)

    # Store user's data in the database
    try:
        c.execute("""INSERT INTO users
                 (username, email, hash, follow)
                 VALUES (?, ?, ?, ?)""",
                 (usern, email, hsh, ""))
        conn.commit()

        c.execute("SELECT id FROM users WHERE username = ?", (usern,))
        session["user_id"] = c.fetchone()[0]

        return redirect("/")
    except sqlite3.IntegrityError:
        # If the username or e-mail is taken
        return render_template("/error.html", err_message="Username or e-mail is already taken.")


@app.route("/login", methods=["POST"])
def login():
    """Log in the user"""
    usern_email  = request.form.get("username")
    passw        = request.form.get("password")
    login_method = "username"

    if re.match(r"\S+@\S+\.\S+", usern_email):
        login_method = "email"

    try:
        # Get the user's id and hash
        c.execute(f"SELECT id, hash FROM users WHERE {login_method} = ?",
                 (usern_email,))

        id_, hsh = c.fetchone()
    except:
        # The submitted username/e-mail is not in the database
        return render_template("/error.html", err_message="Wrong username/e-mail")

    # The password is wrong
    if not check_password_hash(hsh, passw):
        return render_template("/error.html", err_message="Wrong password.")

    session["user_id"] = id_

    return redirect("/")


@app.route("/follow", methods=["GET"])
def follow():
    """Manage followed coins"""
    try:
        id_ = session["user_id"]
    except:
        return jsonify(False)

    # Get the string of followed coins of the user
    c.execute("SELECT follow FROM users WHERE id = ?", (id_,))

    try:
        follow_coins = c.fetchone()[0].split(",")
    # If the user doesn't have followed coins
    except:
        follow_coins = []

    # If the request has arguments / The user clicked on the heart
    if request.args:
        symbol = request.args.get("symbol")

        # If the symbol from the argument is in `follow_coins`
        if symbol in follow_coins:
            follow_coins.remove(symbol)
        else:
            follow_coins.append(symbol)

        # Join the list and overwrite it in the database
        c.execute("UPDATE users SET follow = ? WHERE id = ?",
                 (",".join(follow_coins), id_))
        conn.commit()

    return jsonify(follow_coins)


@app.route("/signout")
def signout():
    """Sign out the user"""
    session.clear()

    return redirect("/")
