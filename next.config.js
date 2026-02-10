/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "plus.unsplash.com" },
      { protocol: "https", hostname: "source.unsplash.com" },
      {
        protocol: "https",
        hostname: "xtzupkndvddpwzfremjd.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },

  async redirects() {
    return [
      // Non-www -> www
      {
        source: "/:path*",
        has: [{ type: "host", value: "localassembly.org" }],
        destination: "https://www.localassembly.org/:path*",
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
