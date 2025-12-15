"""
Test script for Visualization Nodes (Phase 5.3)
Tests QuickPlotNode and DataFrameToTableNode with various chart types
"""

import sys
import json
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

import pandas as pd
from app.nodes.viz_nodes import QuickPlotNode, DataFrameToTableNode


def test_line_chart():
    """Test line chart generation"""
    print("\n" + "="*80)
    print("TEST 1: Line Chart")
    print("="*80)
    
    # Sample data: Monthly sales
    df = pd.DataFrame({
        'Month': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        'Sales': [120, 150, 180, 170, 200, 220]
    })
    
    print("\nInput DataFrame:")
    print(df)
    
    node = QuickPlotNode()
    result = node.generate_chart(
        dataframe=df,
        chart_type='line',
        x_column='Month',
        y_column='Sales',
        title='Monthly Sales Trend',
        legend_show=True
    )
    
    option_json = result[0]
    option = json.loads(option_json)
    
    print("\n✅ Chart option generated successfully!")
    print(f"Chart type: {option['series'][0]['type']}")
    print(f"Title: {option['title']['text']}")
    print(f"X-axis data: {option['xAxis']['data']}")
    print(f"Y-axis data: {option['series'][0]['data']}")
    
    return option_json


def test_bar_chart():
    """Test bar chart generation"""
    print("\n" + "="*80)
    print("TEST 2: Bar Chart")
    print("="*80)
    
    # Sample data: Department expenses
    df = pd.DataFrame({
        'Department': ['HR', 'IT', 'Marketing', 'Sales', 'Finance'],
        'Expense': [45000, 120000, 80000, 95000, 60000]
    })
    
    print("\nInput DataFrame:")
    print(df)
    
    node = QuickPlotNode()
    result = node.generate_chart(
        dataframe=df,
        chart_type='bar',
        x_column='Department',
        y_column='Expense',
        title='Department Expenses',
        legend_show=True
    )
    
    option_json = result[0]
    option = json.loads(option_json)
    
    print("\n✅ Chart option generated successfully!")
    print(f"Chart type: {option['series'][0]['type']}")
    print(f"Number of departments: {len(option['xAxis']['data'])}")
    
    return option_json


def test_pie_chart():
    """Test pie chart generation"""
    print("\n" + "="*80)
    print("TEST 3: Pie Chart")
    print("="*80)
    
    # Sample data: Market share
    df = pd.DataFrame({
        'Company': ['Company A', 'Company B', 'Company C', 'Company D', 'Others'],
        'Share': [30, 25, 20, 15, 10]
    })
    
    print("\nInput DataFrame:")
    print(df)
    
    node = QuickPlotNode()
    result = node.generate_chart(
        dataframe=df,
        chart_type='pie',
        x_column='Company',
        y_column='Share',
        title='Market Share Distribution',
        legend_show=True
    )
    
    option_json = result[0]
    option = json.loads(option_json)
    
    print("\n✅ Chart option generated successfully!")
    print(f"Chart type: {option['series'][0]['type']}")
    print(f"Number of slices: {len(option['series'][0]['data'])}")
    
    return option_json


def test_scatter_chart():
    """Test scatter chart generation"""
    print("\n" + "="*80)
    print("TEST 4: Scatter Chart")
    print("="*80)
    
    # Sample data: Age vs Income
    df = pd.DataFrame({
        'Age': [25, 30, 35, 40, 45, 50, 55, 60],
        'Income': [35000, 45000, 55000, 65000, 75000, 80000, 85000, 90000]
    })
    
    print("\nInput DataFrame:")
    print(df)
    
    node = QuickPlotNode()
    result = node.generate_chart(
        dataframe=df,
        chart_type='scatter',
        x_column='Age',
        y_column='Income',
        title='Age vs Income Correlation',
        legend_show=True
    )
    
    option_json = result[0]
    option = json.loads(option_json)
    
    print("\n✅ Chart option generated successfully!")
    print(f"Chart type: {option['series'][0]['type']}")
    print(f"Number of points: {len(option['series'][0]['data'])}")
    
    return option_json


def test_area_chart():
    """Test area chart generation"""
    print("\n" + "="*80)
    print("TEST 5: Area Chart")
    print("="*80)
    
    # Sample data: Revenue over time
    df = pd.DataFrame({
        'Quarter': ['Q1', 'Q2', 'Q3', 'Q4'],
        'Revenue': [100000, 150000, 180000, 220000]
    })
    
    print("\nInput DataFrame:")
    print(df)
    
    node = QuickPlotNode()
    result = node.generate_chart(
        dataframe=df,
        chart_type='area',
        x_column='Quarter',
        y_column='Revenue',
        title='Quarterly Revenue',
        legend_show=True
    )
    
    option_json = result[0]
    option = json.loads(option_json)
    
    print("\n✅ Chart option generated successfully!")
    print(f"Chart type: {option['series'][0]['type']}")
    print(f"Has area fill: {'areaStyle' in option['series'][0]}")
    
    return option_json


def test_dataframe_to_table():
    """Test DataFrame to HTML table conversion"""
    print("\n" + "="*80)
    print("TEST 6: DataFrame to Table")
    print("="*80)
    
    # Sample data
    df = pd.DataFrame({
        'Product': ['A', 'B', 'C', 'D', 'E'],
        'Sales': [100, 150, 200, 120, 180],
        'Profit': [20, 30, 50, 25, 40]
    })
    
    print("\nInput DataFrame:")
    print(df)
    
    node = DataFrameToTableNode()
    result = node.convert_to_table(
        dataframe=df,
        max_rows=10,
        include_index=False
    )
    
    html = result[0]
    
    print("\n✅ HTML table generated successfully!")
    print(f"HTML length: {len(html)} characters")
    print(f"Contains <table>: {'<table' in html}")
    
    return html


def test_error_handling():
    """Test error handling with invalid inputs"""
    print("\n" + "="*80)
    print("TEST 7: Error Handling")
    print("="*80)
    
    df = pd.DataFrame({
        'A': [1, 2, 3],
        'B': [4, 5, 6]
    })
    
    node = QuickPlotNode()
    
    # Test with non-existent column
    print("\nTest 7a: Invalid column name")
    result = node.generate_chart(
        dataframe=df,
        chart_type='line',
        x_column='InvalidColumn',
        y_column='B',
        title='Error Test'
    )
    
    option = json.loads(result[0])
    if 'graphic' in option:
        print(f"✅ Error handled gracefully: {option['graphic']['style']['text']}")
    
    # Test with empty DataFrame
    print("\nTest 7b: Empty DataFrame")
    empty_df = pd.DataFrame()
    result = node.generate_chart(
        dataframe=empty_df,
        chart_type='line',
        x_column='A',
        y_column='B',
        title='Empty Data Test'
    )
    
    option = json.loads(result[0])
    if 'graphic' in option:
        print(f"✅ Error handled gracefully: {option['graphic']['style']['text']}")


def save_sample_outputs():
    """Save sample chart options to files for frontend testing"""
    print("\n" + "="*80)
    print("Saving Sample Outputs")
    print("="*80)
    
    output_dir = Path(__file__).parent / "sample_charts"
    output_dir.mkdir(exist_ok=True)
    
    # Generate and save each chart type
    charts = {
        'line': test_line_chart(),
        'bar': test_bar_chart(),
        'pie': test_pie_chart(),
        'scatter': test_scatter_chart(),
        'area': test_area_chart()
    }
    
    for chart_type, option_json in charts.items():
        output_file = output_dir / f"{chart_type}_chart.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            # Pretty print JSON
            option = json.loads(option_json)
            json.dump(option, f, ensure_ascii=False, indent=2)
        print(f"✅ Saved {chart_type} chart to {output_file}")
    
    print(f"\n📁 All sample charts saved to: {output_dir}")


if __name__ == "__main__":
    print("="*80)
    print("VISUALIZATION NODES TEST SUITE")
    print("="*80)
    
    try:
        # Run all tests
        test_line_chart()
        test_bar_chart()
        test_pie_chart()
        test_scatter_chart()
        test_area_chart()
        test_dataframe_to_table()
        test_error_handling()
        
        # Save sample outputs
        save_sample_outputs()
        
        print("\n" + "="*80)
        print("✅ ALL TESTS PASSED!")
        print("="*80)
        print("\n📊 Visualization nodes are ready to use!")
        print("📁 Sample chart JSONs saved in backend/sample_charts/")
        print("\nNext steps:")
        print("1. Start the backend: cd backend && uvicorn app.main:app --reload")
        print("2. Start the frontend: npm run dev")
        print("3. Add QuickPlotNode to a workflow and connect a DataFrame")
        print("4. Use ChartViewer component to display the chart option JSON")
        
    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
