import urllib.request, urllib.error
try:
    req = urllib.request.Request('http://127.0.0.1:8000/api/upload', method='POST')
    urllib.request.urlopen(req)
except urllib.error.HTTPError as e:
    print(e.read().decode())
