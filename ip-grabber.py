import requests

_ip = "2a09:bac2:6289:123c::1d1:d2" # temp for now. ill change it when we have a way to get the user's ip

def get_local_coordinates(ipAddress=""):
    url = f"https://freeipapi.com/api/json/{ipAddress}"

    try:
        response = requests.get(url)
        response.raise_for_status()

        data = response.json()

        city = data['cityName']
        latitude = data['latitude']
        longitude = data['longitude']

        print(f"in {city}")
        print(f"latitude: {latitude} -- longitude: {longitude}")

        return city, latitude, longitude
    
    except requests.exceptions.RequestException as e:
        print(f"network error: {e}")

        return None, None, None
    
my_coords = get_local_coordinates(_ip)