#!/usr/bin/env python3
"""
Simple script to create basic PNG icons for the Chrome extension.
Requires Pillow: pip install Pillow
"""

from PIL import Image, ImageDraw, ImageFont
import os

def create_icon(size, filename):
    """Create a simple bookmark icon with the given size"""
    
    # Create a new image with a transparent background
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Define colors
    bg_color = (37, 99, 235)  # Primary blue color from the app
    text_color = (255, 255, 255)  # White
    
    # Draw rounded rectangle background
    margin = size // 8
    draw.rounded_rectangle(
        [margin, margin, size - margin, size - margin],
        radius=size // 6,
        fill=bg_color
    )
    
    # Calculate bookmark icon dimensions
    bookmark_width = size // 2
    bookmark_height = int(size * 0.6)
    bookmark_x = (size - bookmark_width) // 2
    bookmark_y = (size - bookmark_height) // 2
    
    # Draw bookmark shape (rectangle with triangular cutout at bottom)
    bookmark_points = [
        bookmark_x, bookmark_y,  # Top left
        bookmark_x + bookmark_width, bookmark_y,  # Top right
        bookmark_x + bookmark_width, bookmark_y + int(bookmark_height * 0.7),  # Right side
        bookmark_x + bookmark_width // 2, bookmark_y + int(bookmark_height * 0.9),  # Bottom point
        bookmark_x, bookmark_y + int(bookmark_height * 0.7),  # Left side
    ]
    
    draw.polygon(bookmark_points, fill=text_color)
    
    # Add a small plus sign for larger icons
    if size >= 32:
        plus_size = size // 8
        plus_x = size - plus_size - 2
        plus_y = 2
        
        # Draw plus background circle
        draw.ellipse(
            [plus_x - 2, plus_y - 2, plus_x + plus_size + 2, plus_y + plus_size + 2],
            fill=(52, 211, 153)  # Green color
        )
        
        # Draw plus sign
        plus_thickness = max(1, plus_size // 4)
        draw.rectangle(
            [plus_x + plus_size//2 - plus_thickness//2, plus_y, 
             plus_x + plus_size//2 + plus_thickness//2, plus_y + plus_size],
            fill=text_color
        )
        draw.rectangle(
            [plus_x, plus_y + plus_size//2 - plus_thickness//2, 
             plus_x + plus_size, plus_y + plus_size//2 + plus_thickness//2],
            fill=text_color
        )
    
    # Save the image
    img.save(filename, 'PNG')
    print(f"Created {filename} ({size}x{size})")

def main():
    """Create all required icon sizes"""
    
    # Get the script directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    icons_dir = os.path.join(os.path.dirname(script_dir), 'extension', 'icons')
    
    # Create icons directory if it doesn't exist
    os.makedirs(icons_dir, exist_ok=True)
    
    # Icon sizes required by Chrome Web Store
    sizes = [16, 32, 48, 128]
    
    for size in sizes:
        filename = os.path.join(icons_dir, f'icon{size}.png')
        create_icon(size, filename)
    
    print("\n✅ All icons created successfully!")
    print("📁 Icons saved to:", icons_dir)
    print("\nNext steps:")
    print("1. Review the generated icons")
    print("2. Consider creating custom icons with a design tool if needed")
    print("3. Update your extension manifest if necessary")

if __name__ == "__main__":
    try:
        main()
    except ImportError:
        print("❌ Error: Pillow library not found")
        print("Install it with: pip install Pillow")
        print("Or create icons manually using any image editor")
    except Exception as e:
        print(f"❌ Error creating icons: {e}")
        print("You can create icons manually using any image editor")
