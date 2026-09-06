const awsmobile = {
    "aws_project_region": "us-east-1",
    "aws_cognito_region": "us-east-1",
    "aws_user_pools_id": import.meta.env.VITE_USER_POOL_ID || "us-east-1_SFrRMOVHi",
    "aws_user_pools_web_client_id": import.meta.env.VITE_USER_POOL_CLIENT_ID || "6ci895vprgja3c4ts2kit1urvl",
    "oauth": {
        "domain": "tracker-abhijeetkharkar.auth.us-east-1.amazoncognito.com",
        "scope": [
            "email",
            "openid",
            "profile"
        ],
        "redirectSignIn": import.meta.env.PROD ? "https://babytracker.abhijeetkharkar.com/" : "http://localhost:5173/",
        "redirectSignOut": import.meta.env.PROD ? "https://babytracker.abhijeetkharkar.com/" : "http://localhost:5173/",
        "responseType": "code"
    },
    "federationTarget": "COGNITO_USER_POOLS",
};

export default awsmobile;
