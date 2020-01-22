import requests

from functools import wraps
from flask import redirect, session
# from newsapi import NewsApiClient


def login_required(f):
    """
    Decorate routes to require login.

    http://flask.pocoo.org/docs/0.12/patterns/viewdecorators/
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if session.get("user_id") is None:
            return redirect("/")
        return f(*args, **kwargs)
    return decorated_function

def lookup(topic, sort_by):
    newsapi = NewsApiClient(api_key='789ef449cb884e9b8783bd504bc0c3e5')

    return newsapi.get_everything(q=topic, language='en', sort_by=sort_by)
